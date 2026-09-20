#![no_std]
//! RunForrest Challenge — koşu yarışmalarının ödül havuzu.
//!
//! Havuz zincirde yaşıyor ve muhasebesi bir DeFindex vault'u üzerinden
//! tutuluyor. Katılımcı, havuzun var olduğunu ve dağıtım kuralının ne
//! olduğunu kimseye güvenmeden doğrulayabilir.
//!
//! Akış:
//!   create_challenge → join (USDC → vault) → record_progress → finalize → claim
//!
//! Vault entegrasyonu dekoratif değil: katılım ücretleri kontratta beklemez,
//! doğrudan vault'a yatar ve kazananlara vault'tan çekilerek ödenir. Vault'u
//! devre dışı bırakırsanız havuz diye bir şey kalmaz.
//!
//! Kullanılan skill dosyaları:
//!   - skills/smart-contracts/SKILL.md
//!   - skills/smart-contracts/development.md  (yetkilendirme ağacı, authorize_as_current_contract)
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

/* ──────────────────────────────── veri ────────────────────────────────── */

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    /// USDC'nin Stellar Asset Contract adresi (anchor'ın ramp ettiği varlık).
    pub usdc: Address,
    /// DeFindex vault — ödül havuzunun custody ve share muhasebesi.
    pub vault: Address,
    /// GPS ilerlemesini onaylayan anahtar. Bkz. README "Güven varsayımları".
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
    /// Katılım ücreti, stroop (7 ondalık). 10 USDC = 100_000_000.
    pub entry_fee: i128,
    pub start_time: u64,
    pub end_time: u64,
    /// Hedef mesafe (metre) — bilgi amaçlı, sıralama gerçek mesafeye göre.
    pub target_distance_m: u32,
    /// Toplanan toplam USDC (stroop).
    pub pool: i128,
    /// Vault'tan alınan toplam share.
    pub shares: i128,
    /// finalize sonrası dağıtılacak toplam (anapara + varsa getiri).
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
    /// finalize'da hesaplanır. 0 ise kazanmamış.
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
    /// Bir yarışmanın katılımcı listesi — finalize'da sıralamak için.
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

/// Vault'un `deposit` dönüşünün üçüncü alanı DeFindex'e özgü karmaşık bir tip
/// (`Option<Vec<Option<AssetInvestmentAllocation>>>`). Tipi buraya kopyalamak
/// yerine `Val` olarak alıp yok sayıyoruz — bize lazım olan `shares`.
type DepositResult = (Vec<i128>, i128, Option<Val>);

/// Vault'taki kendi share bakiyemiz. Vault bir SEP-41 token'ı gibi davranır.
fn vault_shares_of_self(env: &Env, cfg: &Config) -> i128 {
    token::Client::new(env, &cfg.vault).balance(&env.current_contract_address())
}

fn vault_deposit(env: &Env, cfg: &Config, amount: i128) -> i128 {
    let me = env.current_contract_address();

    // DeFindex'in `deposit` dönüşündeki share sayısı GERÇEKTE basılandan
    // farklı olabiliyor: vault ilk yatırımda bir miktar minimum likidite
    // kilitliyor (canlı testnet'te 10 USDC yatırımda 1000 stroop fark).
    // Dönen değere güvenip fazla share kaydedersek finalize'da sahip
    // olmadığımız kadar share çekmeye çalışır ve yarışma kilitlenir.
    // Bu yüzden gerçek bakiye farkını ölçüyoruz.
    let before = vault_shares_of_self(env, cfg);

    let mut desired = Vec::new(env);
    desired.push_back(amount);
    let mut min = Vec::new(env);
    min.push_back(amount); // tek varlıklı vault: slippage yok, tamamı yatmalı

    // Vault, USDC'yi bizden kendine çekecek. Bu, vault'un İÇİNDEN yapılan
    // daha derin bir çağrı — doğrudan çağrı yetkisi buraya ulaşmaz, o yüzden
    // token transferini ayrıca yetkilendiriyoruz.
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
        true.into_val(env), // invest: strateji varsa getiriye koş
    ];

    let _res: DepositResult =
        env.invoke_contract(&cfg.vault, &Symbol::new(env, "deposit"), args);

    // Bu yarışmanın gerçekten sahip olduğu share = bakiye farkı.
    vault_shares_of_self(env, cfg) - before
}

fn vault_withdraw(env: &Env, cfg: &Config, shares: i128) -> i128 {
    let me = env.current_contract_address();

    // Savunma: yuvarlama ya da beklenmedik bir vault davranışı yüzünden
    // kayıtlı share gerçek bakiyeden fazlaysa, olanı çek. Bir yarışmanın
    // finalize'ı hiçbir koşulda kilitlenmemeli.
    let available = vault_shares_of_self(env, cfg);
    let shares = if shares > available { available } else { shares };
    if shares <= 0 {
        return 0;
    }

    let mut min_out = Vec::new(env);
    min_out.push_back(0i128); // finalize bloke olmasın; gerçekte gelen ne ise o

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

    /// Yeni yarışma açar. Ücret toplanmaz — katılımda toplanır.
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

    /// Yarışmaya katılır: USDC ücreti alınır ve DOĞRUDAN vault'a yatırılır.
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

        // Ücreti koşucudan kontrata al.
        token::Client::new(&env, &cfg.usdc).transfer(
            &runner,
            &env.current_contract_address(),
            &challenge.entry_fee,
        );

        // Ve hemen vault'a yatır — havuz burada durmaz.
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

    /// Koşu ilerlemesini kaydeder.
    ///
    /// GPS iki günlük bir hackathon penceresinde trustless doğrulanamaz; bu
    /// fonksiyon bir attestor anahtarına güvenir. Bu bilinçli ve README'de
    /// açıkça belirtilen bir tavizdir — gizlenmiş bir merkeziyet değil.
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

    /// Yarışmayı kapatır: vault'tan çeker, sıralar, payları hesaplar.
    /// Herkes çağırabilir — bitiş zamanı geçtiyse.
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

        // Havuzun tamamını vault'tan geri çek (anapara + varsa getiri).
        let recovered = vault_withdraw(&env, &cfg, challenge.shares);
        challenge.payout_pool = recovered;

        // Mesafeye göre ilk üçü bul.
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
                continue; // hiç koşmayan sıralamaya girmez
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

        // Hiç kimse koşmadıysa (attestor düşmüş, pencere kısa kalmış, kimse
        // çıkmamış) kazanan yok. Havuzu dağıtmadan bırakmak fonları kontratta
        // kalıcı olarak kilitler: herkesin payout'u 0 kalır, claim() herkese
        // NothingToClaim döner ve para bir daha çıkmaz.
        // Bu durumda katılım ücretleri sahiplerine iade edilir.
        let (payees, splits): (Vec<Address>, Vec<i128>) = if top.is_empty() {
            let n = roster.len() as i128;
            let mut equal = Vec::new(&env);
            for _ in 0..roster.len() {
                equal.push_back(100 / n);
            }
            (roster.clone(), equal)
        } else {
            // Dağıtım: 3+ kazanan 50/30/20, 2 kazanan 60/40, tek kazanan %100.
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
                // son alan kalanı alır — yuvarlama artığı kimsede kalmasın
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

    /// Kazanan payını çeker.
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

        // Önce yaz, sonra gönder — reentrancy'ye kapalı.
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

/* ──────────────────────────────── yardımcı ────────────────────────────── */

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
