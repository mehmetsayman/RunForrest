#![no_std]
//! RunForrest Challenge — the prize pool for running challenges.
//!
//! The pool lives on chain and is accounted for through a DeFindex vault.
//! A participant can verify that the pool exists and what the payout rule
//! is without trusting anyone.
//!
//! Flow:
//!   create_challenge → join (USDC → vault) → record_progress → finalize → claim
//!
//! The vault integration is not decorative: entry fees never sit in this
//! contract. They go straight into the vault and winners are paid by
//! withdrawing from it. Remove the vault and there is no pool at all.
//!
//! Skill files used:
//!   - skills/smart-contracts/SKILL.md
//!   - skills/smart-contracts/development.md  (auth tree, authorize_as_current_contract)
//!   - skills/smart-contracts/security.md
//!   - soroban-common-mistakes/SKILL.md

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractevent, contractimpl, contracttype,
    token, Address, Env, IntoVal, Symbol, Val, Vec,
};

/* ──────────────────────────────── hatalar ─────────────────────────────── */

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ChallengeNotFound = 3,
    ChallengeClosed = 4,
    ChallengeNotOver = 5,
    AlreadyFinalized = 6,
    NotFinalized = 7,
    AlreadyJoined = 8,
    NotParticipant = 9,
    AlreadyClaimed = 10,
    NothingToClaim = 11,
    InvalidEntryFee = 12,
    InvalidWindow = 13,
    NoParticipants = 14,
}

/* ──────────────────────────────── data ────────────────────────────────── */

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    /// USDC's Stellar Asset Contract address (the asset the anchor ramps).
    pub usdc: Address,
    /// DeFindex vault — custody and share accounting for the prize pool.
    pub vault: Address,
    /// The key that attests GPS progress. See "Trust assumptions" in the README.
    pub attestor: Address,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Open,
    Finalized,
}

#[contracttype]
#[derive(Clone)]
pub struct Challenge {
    pub creator: Address,
    /// Entry fee, in stroops (7 decimals). 10 USDC = 100_000_000.
    pub entry_fee: i128,
    pub start_time: u64,
    pub end_time: u64,
    /// Target distance (metres) — informational; ranking uses actual distance.
    pub target_distance_m: u32,
    /// Toplanan toplam USDC (stroop).
    pub pool: i128,
    /// Total shares received from the vault.
    pub shares: i128,
    /// Total to distribute after finalize (principal plus any yield).
    pub payout_pool: i128,
    pub participants: u32,
    pub status: Status,
}

#[contracttype]
#[derive(Clone)]
pub struct Participant {
    pub distance_m: u32,
    pub runs: u32,
    pub joined_at: u64,
    /// Computed at finalize. Zero means they did not win.
    pub payout: i128,
    pub claimed: bool,
}

/* ──────────────────────────────── olaylar ─────────────────────────────── */

#[contractevent]
pub struct Created {
    #[topic]
    pub challenge_id: u32,
    pub creator: Address,
    pub entry_fee: i128,
}

#[contractevent]
pub struct Joined {
    #[topic]
    pub challenge_id: u32,
    pub runner: Address,
    pub shares: i128,
}

#[contractevent]
pub struct Progress {
    #[topic]
    pub challenge_id: u32,
    pub runner: Address,
    pub total_distance_m: u32,
}

#[contractevent]
pub struct Finalized {
    #[topic]
    pub challenge_id: u32,
    pub payout_pool: i128,
    pub winners: u32,
}

#[contractevent]
pub struct Claimed {
    #[topic]
    pub challenge_id: u32,
    pub runner: Address,
    pub amount: i128,
}

#[contracttype]
pub enum DataKey {
    Config,
    NextId,
    Challenge(u32),
    Participant(u32, Address),
    /// A challenge's roster — used for ranking at finalize.
    Roster(u32),
}

/* ───────────────────────────── depolama TTL ───────────────────────────── */

const DAY: u32 = 17_280; // ~5 sn/ledger
const LIFE: u32 = DAY * 90;
const BUMP: u32 = DAY * 60;

fn extend_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP, LIFE);
}

fn extend_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, BUMP, LIFE);
}

/* ─────────────────────── DeFindex vault istemcisi ─────────────────────── */

/// The third field of the vault's `deposit` return is a DeFindex-specific
/// compound type (`Option<Vec<Option<AssetInvestmentAllocation>>>`). Rather
/// than copy it here we take it as `Val` and ignore it; we only need `shares`.
type DepositResult = (Vec<i128>, i128, Option<Val>);

/// Our own share balance in the vault. The vault behaves like a SEP-41 token.
fn vault_shares_of_self(env: &Env, cfg: &Config) -> i128 {
    token::Client::new(env, &cfg.vault).balance(&env.current_contract_address())
}

fn vault_deposit(env: &Env, cfg: &Config, amount: i128) -> i128 {
    let me = env.current_contract_address();

    // The share count DeFindex returns from `deposit` can differ from what is
    // ACTUALLY minted: the vault withholds some minimum liquidity on the first
    // deposit (on live testnet, 1000 stroops on a 10 USDC deposit).
    // Trusting the returned value would record more shares than we hold, and
    // finalize would try to withdraw shares we do not have, locking the challenge.
    // So we measure the real balance delta instead.
    let before = vault_shares_of_self(env, cfg);

    let mut desired = Vec::new(env);
    desired.push_back(amount);
    let mut min = Vec::new(env);
    min.push_back(amount); // single-asset vault: no slippage, all of it must land

    // The vault will pull the USDC from us. That is a deeper call made from
    // INSIDE the vault, and authority for a direct call does not reach it, so
    // we authorise the token transfer separately.
    env.authorize_as_current_contract(soroban_sdk::vec![
        env,
        InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: cfg.usdc.clone(),
                fn_name: Symbol::new(env, "transfer"),
                args: (me.clone(), cfg.vault.clone(), amount).into_val(env),
            },
            sub_invocations: soroban_sdk::vec![env],
        })
    ]);

    let args: Vec<Val> = soroban_sdk::vec![
        env,
        desired.into_val(env),
        min.into_val(env),
        me.into_val(env),
        true.into_val(env), // invest: put it to work if a strategy exists
    ];

    let _res: DepositResult =
        env.invoke_contract(&cfg.vault, &Symbol::new(env, "deposit"), args);

    // The shares this challenge actually owns = the balance delta.
    vault_shares_of_self(env, cfg) - before
}

fn vault_withdraw(env: &Env, cfg: &Config, shares: i128) -> i128 {
    let me = env.current_contract_address();

    // Defensive: if rounding or unexpected vault behaviour leaves the recorded
    // shares above the real balance, withdraw what is there. Finalizing a
    // challenge must never lock up, under any circumstances.
    let available = vault_shares_of_self(env, cfg);
    let shares = if shares > available { available } else { shares };
    if shares <= 0 {
        return 0;
    }

    let mut min_out = Vec::new(env);
    min_out.push_back(0i128); // never block finalize; take whatever actually comes back

    let args: Vec<Val> = soroban_sdk::vec![
        env,
        shares.into_val(env),
        min_out.into_val(env),
        me.into_val(env),
    ];

    let amounts: Vec<i128> =
        env.invoke_contract(&cfg.vault, &Symbol::new(env, "withdraw"), args);

    amounts.get(0).unwrap_or(0)
}

/* ──────────────────────────────── kontrat ─────────────────────────────── */

#[contract]
pub struct RunForrestChallenge;

#[contractimpl]
impl RunForrestChallenge {
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc: Address,
        vault: Address,
        attestor: Address,
    ) {
        if env.storage().instance().has(&DataKey::Config) {
            panic_with_error(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(
            &DataKey::Config,
            &Config { admin, usdc, vault, attestor },
        );
        env.storage().instance().set(&DataKey::NextId, &0u32);
        extend_instance(&env);
    }

    pub fn config(env: Env) -> Result<Config, Error> {
        load_config(&env)
    }

    /// Opens a new challenge. No fee is collected here; that happens on join.
    pub fn create_challenge(
        env: Env,
        creator: Address,
        entry_fee: i128,
        start_time: u64,
        end_time: u64,
        target_distance_m: u32,
    ) -> Result<u32, Error> {
        creator.require_auth();

        if entry_fee <= 0 {
            return Err(Error::InvalidEntryFee);
        }
        if end_time <= start_time || end_time <= env.ledger().timestamp() {
            return Err(Error::InvalidWindow);
        }

        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        let challenge = Challenge {
            creator: creator.clone(),
            entry_fee,
            start_time,
            end_time,
            target_distance_m,
            pool: 0,
            shares: 0,
            payout_pool: 0,
            participants: 0,
            status: Status::Open,
        };

        let key = DataKey::Challenge(id);
        env.storage().persistent().set(&key, &challenge);
        extend_persistent(&env, &key);

        let roster: Vec<Address> = Vec::new(&env);
        let rkey = DataKey::Roster(id);
        env.storage().persistent().set(&rkey, &roster);
        extend_persistent(&env, &rkey);

        extend_instance(&env);
        Created { challenge_id: id, creator, entry_fee }.publish(&env);
        Ok(id)
    }

    /// Joins a challenge: the USDC fee is taken and deposited STRAIGHT into the vault.
    pub fn join(env: Env, challenge_id: u32, runner: Address) -> Result<(), Error> {
        runner.require_auth();

        let cfg = load_config(&env)?;
        let mut challenge = load_challenge(&env, challenge_id)?;

        if challenge.status != Status::Open {
            return Err(Error::AlreadyFinalized);
        }
        if env.ledger().timestamp() >= challenge.end_time {
            return Err(Error::ChallengeClosed);
        }

        let pkey = DataKey::Participant(challenge_id, runner.clone());
        if env.storage().persistent().has(&pkey) {
            return Err(Error::AlreadyJoined);
        }

        // Take the fee from the runner into this contract.
        token::Client::new(&env, &cfg.usdc).transfer(
            &runner,
            &env.current_contract_address(),
            &challenge.entry_fee,
        );

        // And deposit it into the vault immediately — the pool does not sit here.
        let shares = vault_deposit(&env, &cfg, challenge.entry_fee);

        challenge.pool += challenge.entry_fee;
        challenge.shares += shares;
        challenge.participants += 1;

        let participant = Participant {
            distance_m: 0,
            runs: 0,
            joined_at: env.ledger().timestamp(),
            payout: 0,
            claimed: false,
        };
        env.storage().persistent().set(&pkey, &participant);
        extend_persistent(&env, &pkey);

        let rkey = DataKey::Roster(challenge_id);
        let mut roster: Vec<Address> =
            env.storage().persistent().get(&rkey).unwrap_or(Vec::new(&env));
        roster.push_back(runner.clone());
        env.storage().persistent().set(&rkey, &roster);
        extend_persistent(&env, &rkey);

        save_challenge(&env, challenge_id, &challenge);
        Joined { challenge_id, runner, shares }.publish(&env);
        Ok(())
    }

    /// Records run progress.
    ///
    /// GPS cannot be verified trustlessly within a two-day hackathon window, so
    /// this function trusts an attestor key. That is a deliberate trade-off,
    /// stated openly in the README — not hidden centralisation.
    pub fn record_progress(
        env: Env,
        challenge_id: u32,
        runner: Address,
        distance_m: u32,
    ) -> Result<(), Error> {
        let cfg = load_config(&env)?;
        cfg.attestor.require_auth();

        let challenge = load_challenge(&env, challenge_id)?;
        if challenge.status != Status::Open {
            return Err(Error::AlreadyFinalized);
        }

        let pkey = DataKey::Participant(challenge_id, runner.clone());
        let mut p: Participant = env
            .storage()
            .persistent()
            .get(&pkey)
            .ok_or(Error::NotParticipant)?;

        p.distance_m += distance_m;
        p.runs += 1;
        env.storage().persistent().set(&pkey, &p);
        extend_persistent(&env, &pkey);

        Progress { challenge_id, runner, total_distance_m: p.distance_m }.publish(&env);
        Ok(())
    }

    /// Closes the challenge: withdraws from the vault, ranks, computes payouts.
    /// Callable by anyone, once the end time has passed.
    pub fn finalize(env: Env, challenge_id: u32) -> Result<i128, Error> {
        let cfg = load_config(&env)?;
        let mut challenge = load_challenge(&env, challenge_id)?;

        if challenge.status == Status::Finalized {
            return Err(Error::AlreadyFinalized);
        }
        if env.ledger().timestamp() < challenge.end_time {
            return Err(Error::ChallengeNotOver);
        }
        if challenge.participants == 0 {
            return Err(Error::NoParticipants);
        }

        // Pull the whole pool back out of the vault (principal plus any yield).
        let recovered = vault_withdraw(&env, &cfg, challenge.shares);
        challenge.payout_pool = recovered;

        // Find the top three by distance.
        let roster: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Roster(challenge_id))
            .unwrap_or(Vec::new(&env));

        let mut top: Vec<Address> = Vec::new(&env);
        let mut top_d: Vec<u32> = Vec::new(&env);

        for runner in roster.iter() {
            let p: Participant = env
                .storage()
                .persistent()
                .get(&DataKey::Participant(challenge_id, runner.clone()))
                .unwrap();
            if p.distance_m == 0 {
                continue; // a runner who never ran does not rank
            }

            let mut pos = top_d.len();
            for i in 0..top_d.len() {
                if p.distance_m > top_d.get(i).unwrap() {
                    pos = i;
                    break;
                }
            }
            if pos < 3 {
                top.insert(pos, runner.clone());
                top_d.insert(pos, p.distance_m);
                if top.len() > 3 {
                    top.pop_back();
                    top_d.pop_back();
                }
            }
        }

        // If nobody ran (the attestor was down, the window was too short, nobody
        // turned up) there is no winner. Leaving the pool undistributed locks the
        // funds in the contract forever: every payout stays 0, claim() returns
        // NothingToClaim to everyone, and the money never leaves.
        // In that case the entry fees are refunded to their owners.
        let (payees, splits): (Vec<Address>, Vec<i128>) = if top.is_empty() {
            let n = roster.len() as i128;
            let mut equal = Vec::new(&env);
            for _ in 0..roster.len() {
                equal.push_back(100 / n);
            }
            (roster.clone(), equal)
        } else {
            // Split: 50/30/20 for 3+ winners, 60/40 for two, 100% for one.
            let s: Vec<i128> = match top.len() {
                1 => soroban_sdk::vec![&env, 100i128],
                2 => soroban_sdk::vec![&env, 60i128, 40i128],
                _ => soroban_sdk::vec![&env, 50i128, 30i128, 20i128],
            };
            (top.clone(), s)
        };

        let mut assigned: i128 = 0;
        for i in 0..payees.len() {
            let runner = payees.get(i).unwrap();
            let share = if i == payees.len() - 1 {
                // the last payee takes the remainder, so no rounding dust is stranded
                challenge.payout_pool - assigned
            } else {
                challenge.payout_pool * splits.get(i).unwrap() / 100
            };
            assigned += share;

            let pkey = DataKey::Participant(challenge_id, runner.clone());
            let mut p: Participant = env.storage().persistent().get(&pkey).unwrap();
            p.payout = share;
            env.storage().persistent().set(&pkey, &p);
            extend_persistent(&env, &pkey);
        }

        challenge.status = Status::Finalized;
        save_challenge(&env, challenge_id, &challenge);

        Finalized {
            challenge_id,
            payout_pool: challenge.payout_pool,
            winners: top.len(),
        }
        .publish(&env);
        Ok(challenge.payout_pool)
    }

    /// Claims a winner's share.
    pub fn claim(env: Env, challenge_id: u32, runner: Address) -> Result<i128, Error> {
        runner.require_auth();

        let cfg = load_config(&env)?;
        let challenge = load_challenge(&env, challenge_id)?;
        if challenge.status != Status::Finalized {
            return Err(Error::NotFinalized);
        }

        let pkey = DataKey::Participant(challenge_id, runner.clone());
        let mut p: Participant = env
            .storage()
            .persistent()
            .get(&pkey)
            .ok_or(Error::NotParticipant)?;

        if p.claimed {
            return Err(Error::AlreadyClaimed);
        }
        if p.payout <= 0 {
            return Err(Error::NothingToClaim);
        }

        // Write first, transfer second — closed to reentrancy.
        let amount = p.payout;
        p.claimed = true;
        env.storage().persistent().set(&pkey, &p);
        extend_persistent(&env, &pkey);

        token::Client::new(&env, &cfg.usdc).transfer(
            &env.current_contract_address(),
            &runner,
            &amount,
        );

        Claimed { challenge_id, runner, amount }.publish(&env);
        Ok(amount)
    }

    /* ─────────────────────────── okuma ─────────────────────────── */

    pub fn get_challenge(env: Env, challenge_id: u32) -> Result<Challenge, Error> {
        load_challenge(&env, challenge_id)
    }

    pub fn get_participant(
        env: Env,
        challenge_id: u32,
        runner: Address,
    ) -> Result<Participant, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Participant(challenge_id, runner))
            .ok_or(Error::NotParticipant)
    }

    pub fn get_roster(env: Env, challenge_id: u32) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Roster(challenge_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn challenge_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(0)
    }
}

/* ──────────────────────────────── helpers ─────────────────────────────── */

fn load_config(env: &Env) -> Result<Config, Error> {
    extend_instance(env);
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(Error::NotInitialized)
}

fn load_challenge(env: &Env, id: u32) -> Result<Challenge, Error> {
    let key = DataKey::Challenge(id);
    let c: Challenge = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ChallengeNotFound)?;
    extend_persistent(env, &key);
    Ok(c)
}

fn save_challenge(env: &Env, id: u32, c: &Challenge) {
    let key = DataKey::Challenge(id);
    env.storage().persistent().set(&key, c);
    extend_persistent(env, &key);
}

fn panic_with_error(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}

mod test;
