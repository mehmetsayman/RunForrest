#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Env,
};

/// DeFindex vault'unun test ikizi.
///
/// Mimics the real vault's `deposit`/`withdraw` signatures and share-token
/// behaviour. The point is not to test the vault, but to verify RunForrest
/// calls it with the right arguments and the right authorisation, and keeps
/// its share accounting correct.
///
/// IMPORTANT: the real DeFindex withholds some minimum liquidity on the first
/// deposit (measured on live testnet: 1000 stroops on a 10 USDC deposit), so
/// the share count returned by `deposit` differs from what is ACTUALLY minted.
/// The mock reproduces this on purpose — it once locked `finalize` for real.
mod mock_vault {
    use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Val, Vec};

    pub const MIN_LIQUIDITY: i128 = 1000;

    #[contracttype]
    pub enum Key {
        Asset,
        Shares(Address),
        Bootstrapped,
    }

    #[contract]
    pub struct MockVault;

    #[contractimpl]
    impl MockVault {
        pub fn __constructor(env: Env, asset: Address) {
            env.storage().instance().set(&Key::Asset, &asset);
            env.storage().instance().set(&Key::Bootstrapped, &false);
        }

        pub fn deposit(
            env: Env,
            amounts_desired: Vec<i128>,
            _amounts_min: Vec<i128>,
            from: Address,
            _invest: bool,
        ) -> (Vec<i128>, i128, Option<Val>) {
            from.require_auth();
            let amount = amounts_desired.get(0).unwrap();
            let asset: Address = env.storage().instance().get(&Key::Asset).unwrap();

            // Like the real vault: it pulls the money to itself (a deep call).
            token::Client::new(&env, &asset).transfer(
                &from,
                &env.current_contract_address(),
                &amount,
            );

            // Minimum liquidity is withheld on the first deposit.
            let boot: bool = env.storage().instance().get(&Key::Bootstrapped).unwrap();
            let minted = if boot { amount } else { amount - MIN_LIQUIDITY };
            env.storage().instance().set(&Key::Bootstrapped, &true);

            let key = Key::Shares(from.clone());
            let cur: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(cur + minted));

            // It reports the un-withheld count on return — as the real vault does.
            (amounts_desired, amount, None)
        }

        pub fn withdraw(
            env: Env,
            withdraw_shares: i128,
            _min_amounts_out: Vec<i128>,
            from: Address,
        ) -> Vec<i128> {
            from.require_auth();
            let asset: Address = env.storage().instance().get(&Key::Asset).unwrap();

            let key = Key::Shares(from.clone());
            let cur: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            if withdraw_shares > cur {
                panic!("sahip olunandan fazla share cekilemez");
            }
            env.storage().persistent().set(&key, &(cur - withdraw_shares));

            token::Client::new(&env, &asset).transfer(
                &env.current_contract_address(),
                &from,
                &withdraw_shares,
            );

            let mut out = Vec::new(&env);
            out.push_back(withdraw_shares);
            out
        }

        /// The vault behaves like a share token.
        pub fn balance(env: Env, id: Address) -> i128 {
            env.storage().persistent().get(&Key::Shares(id)).unwrap_or(0)
        }
    }
}

struct Fixture<'a> {
    env: Env,
    client: RunForrestChallengeClient<'a>,
    vault_client: mock_vault::MockVaultClient<'a>,
    usdc: Address,
    token: TokenClient<'a>,
    admin: Address,
}

const USDC: i128 = 10_000_000; // 1 USDC = 10^7 stroop

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let attestor = Address::generate(&env);

    // USDC (Stellar Asset Contract)
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc = sac.address();

    let vault = env.register(mock_vault::MockVault, (usdc.clone(),));

    let contract_id = env.register(
        RunForrestChallenge,
        (admin.clone(), usdc.clone(), vault.clone(), attestor.clone()),
    );

    Fixture {
        client: RunForrestChallengeClient::new(&env, &contract_id),
        vault_client: mock_vault::MockVaultClient::new(&env, &vault),
        token: TokenClient::new(&env, &usdc),
        usdc,
        admin,
        env,
    }
}

fn fund(f: &Fixture, who: &Address, usdc_amount: i128) {
    StellarAssetClient::new(&f.env, &f.usdc).mint(who, &usdc_amount);
}

fn runner(f: &Fixture, usdc_amount: i128) -> Address {
    let a = Address::generate(&f.env);
    fund(f, &a, usdc_amount);
    a
}

fn open_challenge(f: &Fixture, fee: i128) -> u32 {
    let now = f.env.ledger().timestamp();
    f.client
        .create_challenge(&f.admin, &fee, &now, &(now + 1000), &5000)
}

#[test]
fn create_and_read_challenge() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);

    let c = f.client.get_challenge(&id);
    assert_eq!(c.entry_fee, 10 * USDC);
    assert_eq!(c.participants, 0);
    assert_eq!(c.status, Status::Open);
    assert_eq!(f.client.challenge_count(), 1);
}

#[test]
fn join_moves_fee_into_the_vault() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);

    f.client.join(&id, &alice);

    // The fee left the runner
    assert_eq!(f.token.balance(&alice), 40 * USDC);
    // and is NOT sitting in the contract — it went to the vault.
    assert_eq!(f.token.balance(&f.client.address), 0);

    let c = f.client.get_challenge(&id);
    assert_eq!(c.pool, 10 * USDC);
    // The vault withholds minimum liquidity on the first deposit; the recorded
    // shares must be the REAL balance delta, not the returned value.
    assert_eq!(c.shares, 10 * USDC - mock_vault::MIN_LIQUIDITY);
    assert_eq!(c.participants, 1);
}

#[test]
fn double_join_is_rejected() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);

    f.client.join(&id, &alice);
    assert_eq!(
        f.client.try_join(&id, &alice),
        Err(Ok(Error::AlreadyJoined))
    );
}

#[test]
fn progress_requires_participation() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let stranger = Address::generate(&f.env);

    assert_eq!(
        f.client.try_record_progress(&id, &stranger, &1000),
        Err(Ok(Error::NotParticipant))
    );
}

#[test]
fn progress_accumulates() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);
    f.client.join(&id, &alice);

    f.client.record_progress(&id, &alice, &3000);
    f.client.record_progress(&id, &alice, &2500);

    let p = f.client.get_participant(&id, &alice);
    assert_eq!(p.distance_m, 5500);
    assert_eq!(p.runs, 2);
}

#[test]
fn cannot_finalize_before_the_window_closes() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);
    f.client.join(&id, &alice);

    assert_eq!(
        f.client.try_finalize(&id),
        Err(Ok(Error::ChallengeNotOver))
    );
}

#[test]
fn three_runners_split_50_30_20() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);

    let alice = runner(&f, 50 * USDC);
    let bob = runner(&f, 50 * USDC);
    let carol = runner(&f, 50 * USDC);

    for r in [&alice, &bob, &carol] {
        f.client.join(&id, r);
    }

    f.client.record_progress(&id, &alice, &12_000);
    f.client.record_progress(&id, &bob, &20_000); // 1.
    f.client.record_progress(&id, &carol, &15_000); // 2.

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    let pool = f.client.finalize(&id);
    assert_eq!(pool, 30 * USDC - mock_vault::MIN_LIQUIDITY);

    // 1st 50%, 2nd 30%, and the last takes the remainder (rounding dust included)
    assert_eq!(f.client.get_participant(&id, &bob).payout, pool * 50 / 100);
    assert_eq!(f.client.get_participant(&id, &carol).payout, pool * 30 / 100);
    assert_eq!(
        f.client.get_participant(&id, &alice).payout,
        pool - pool * 50 / 100 - pool * 30 / 100
    );
}

#[test]
fn winner_claims_and_cannot_claim_twice() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);
    let bob = runner(&f, 50 * USDC);

    f.client.join(&id, &alice);
    f.client.join(&id, &bob);
    f.client.record_progress(&id, &alice, &9000);
    f.client.record_progress(&id, &bob, &4000);

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    let pool = f.client.finalize(&id);

    // 2 kazanan → 60/40
    let expected = pool * 60 / 100;
    let got = f.client.claim(&id, &alice);
    assert_eq!(got, expected);
    assert_eq!(f.token.balance(&alice), 40 * USDC + expected);

    assert_eq!(
        f.client.try_claim(&id, &alice),
        Err(Ok(Error::AlreadyClaimed))
    );
}

#[test]
fn runner_who_never_ran_gets_nothing() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);
    let idle = runner(&f, 50 * USDC);

    f.client.join(&id, &alice);
    f.client.join(&id, &idle);
    f.client.record_progress(&id, &alice, &9000);

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    f.client.finalize(&id);

    assert_eq!(f.client.get_participant(&id, &idle).payout, 0);
    assert_eq!(
        f.client.try_claim(&id, &idle),
        Err(Ok(Error::NothingToClaim))
    );
    // A single runner takes the whole pool
    assert_eq!(
        f.client.get_participant(&id, &alice).payout,
        20 * USDC - mock_vault::MIN_LIQUIDITY
    );
}

#[test]
fn whole_pool_is_distributed_no_dust_left() {
    let f = setup();
    // Build a pool that does not divide by 3: 3 × 3.3333333 USDC
    let fee = 33_333_333i128;
    let id = open_challenge(&f, fee);

    let a = runner(&f, 50 * USDC);
    let b = runner(&f, 50 * USDC);
    let c = runner(&f, 50 * USDC);
    for r in [&a, &b, &c] {
        f.client.join(&id, r);
    }
    f.client.record_progress(&id, &a, &3000);
    f.client.record_progress(&id, &b, &2000);
    f.client.record_progress(&id, &c, &1000);

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    let pool = f.client.finalize(&id);

    let total = f.client.get_participant(&id, &a).payout
        + f.client.get_participant(&id, &b).payout
        + f.client.get_participant(&id, &c).payout;
    assert_eq!(total, pool, "the whole pool must be distributed, with no dust left");
}

#[test]
fn finalize_is_idempotent() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);
    f.client.join(&id, &alice);
    f.client.record_progress(&id, &alice, &5000);

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    f.client.finalize(&id);

    assert_eq!(
        f.client.try_finalize(&id),
        Err(Ok(Error::AlreadyFinalized))
    );
}

#[test]
fn join_after_deadline_is_rejected() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    assert_eq!(
        f.client.try_join(&id, &alice),
        Err(Ok(Error::ChallengeClosed))
    );
}

/// REGRESSION: caught on live testnet.
///
/// DeFindex's `deposit` reports more shares than are actually minted (it
/// withholds minimum liquidity on the first deposit). Had the contract
/// recorded the returned value, `finalize` would try to withdraw shares it
/// does not own, and the challenge would be locked forever.
#[test]
fn recorded_shares_match_the_real_vault_balance() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);
    let alice = runner(&f, 50 * USDC);
    let bob = runner(&f, 50 * USDC);

    f.client.join(&id, &alice);
    f.client.join(&id, &bob);

    let c = f.client.get_challenge(&id);
    let real = f.vault_client.balance(&f.client.address);

    assert_eq!(
        c.shares, real,
        "recorded shares must match the real vault balance exactly"
    );

    // And finalize must actually be able to withdraw — no lock-up.
    f.client.record_progress(&id, &alice, &5000);
    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    let pool = f.client.finalize(&id);
    assert_eq!(pool, real);
}

/// REGRESSION: with nobody running, the pool must not lock up in the contract.
///
/// If there are participants but none of their runs was attested (the attestor
/// was down, the window was too short, nobody turned up) there is no winner.
/// Without a distribution every payout stays 0, claim() returns NothingToClaim
/// to everyone, and the money pulled from the vault is stranded forever.
///
/// Correct behaviour: the entry fees are refunded to their owners.
#[test]
fn nobody_ran_refunds_every_participant() {
    let f = setup();
    let id = open_challenge(&f, 10 * USDC);

    let a = runner(&f, 50 * USDC);
    let b = runner(&f, 50 * USDC);
    let c = runner(&f, 50 * USDC);
    for r in [&a, &b, &c] {
        f.client.join(&id, r);
    }
    // record_progress is deliberately never called.

    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 2000);
    let pool = f.client.finalize(&id);

    let pa = f.client.get_participant(&id, &a).payout;
    let pb = f.client.get_participant(&id, &b).payout;
    let pc = f.client.get_participant(&id, &c).payout;

    assert!(pa > 0 && pb > 0 && pc > 0, "everyone must be refunded");
    assert_eq!(pa + pb + pc, pool, "the whole pool must be refunded");

    // And it must actually be claimable — no money left in the contract.
    let before = f.token.balance(&a);
    let got = f.client.claim(&id, &a);
    assert_eq!(got, pa);
    assert_eq!(f.token.balance(&a), before + pa);

    f.client.claim(&id, &b);
    f.client.claim(&id, &c);
    assert_eq!(
        f.token.balance(&f.client.address),
        0,
        "no money may stay stranded in the contract"
    );
}
