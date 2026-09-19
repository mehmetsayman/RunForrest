#![no_std]
//! RunForrest Badge — şehir başarı rozetleri.
//!
//! Rozet gerçek zincir durumu: hangi şehirde kaç koşu yapıldığı burada
//! tutulur ve herkes tarafından okunabilir.
//!
//! Rozetler DEVREDİLEMEZ (soulbound). Bilinçli bir seçim: ürünün iddiası
//! "proof of active lifestyle" — satın alınabilen bir kanıt kanıt değildir.
//! Bu aynı zamanda transfer/approve yüzeyini tamamen ortadan kaldırıyor.
//!
//! Kullanılan skill dosyaları:
//!   - skills/smart-contracts/SKILL.md
//!   - skills/smart-contracts/development.md
//!   - soroban-common-mistakes/SKILL.md

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address,
    Env, String, Vec,
};

/* ──────────────────────────────── hatalar ─────────────────────────────── */

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    BadgeNotFound = 3,
    InvalidDistance = 4,
}

/* ──────────────────────────────── veri ────────────────────────────────── */

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    /// Koşu kaydı yazabilen tek adres (attestor ya da challenge kontratı).
    pub minter: Address,
}

/// Orijinal RunForrest'ın kademe tablosu korundu.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tier {
    /// 1–5 koşu
    Common,
    /// 6–15
    Rare,
    /// 16–25
    Epic,
    /// 26+
    Legendary,
}

fn tier_for(runs: u32) -> Tier {
    match runs {
        0..=5 => Tier::Common,
        6..=15 => Tier::Rare,
        16..=25 => Tier::Epic,
        _ => Tier::Legendary,
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Badge {
    pub city: String,
    pub runs: u32,
    /// Bu şehirde koşulan toplam mesafe (metre).
    pub total_distance_m: u64,
    pub tier: Tier,
    pub first_earned: u64,
    pub last_run: u64,
}

#[contracttype]
pub enum DataKey {
    Config,
    Badge(Address, String),
    /// Koşucunun rozet kazandığı şehirler.
    Cities(Address),
}

/* ──────────────────────────────── olaylar ─────────────────────────────── */

#[contractevent]
pub struct BadgeEarned {
    #[topic]
    pub runner: Address,
    pub city: String,
    pub tier: Tier,
}

#[contractevent]
pub struct TierUp {
    #[topic]
    pub runner: Address,
    pub city: String,
    pub from: Tier,
    pub to: Tier,
    pub runs: u32,
}

/* ───────────────────────────── depolama TTL ───────────────────────────── */

const DAY: u32 = 17_280;
const LIFE: u32 = DAY * 90;
const BUMP: u32 = DAY * 60;

/* ──────────────────────────────── kontrat ─────────────────────────────── */

#[contract]
pub struct RunForrestBadge;

#[contractimpl]
impl RunForrestBadge {
    pub fn __constructor(env: Env, admin: Address, minter: Address) {
        if env.storage().instance().has(&DataKey::Config) {
            soroban_sdk::panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { admin, minter });
        env.storage().instance().extend_ttl(BUMP, LIFE);
    }

    pub fn config(env: Env) -> Result<Config, Error> {
        env.storage().instance().extend_ttl(BUMP, LIFE);
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    /// Bir şehirde tamamlanan koşuyu kaydeder. İlk koşu rozeti yaratır,
    /// sonrakiler sayacı ilerletir ve gerektiğinde kademeyi yükseltir.
    pub fn record_run(
        env: Env,
        runner: Address,
        city: String,
        distance_m: u32,
    ) -> Result<Tier, Error> {
        let cfg: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;
        cfg.minter.require_auth();

        if distance_m == 0 {
            return Err(Error::InvalidDistance);
        }

        let now = env.ledger().timestamp();
        let key = DataKey::Badge(runner.clone(), city.clone());

        let badge = match env.storage().persistent().get::<_, Badge>(&key) {
            Some(mut b) => {
                let before = b.tier;
                b.runs += 1;
                b.total_distance_m += distance_m as u64;
                b.tier = tier_for(b.runs);
                b.last_run = now;

                if b.tier != before {
                    TierUp {
                        runner: runner.clone(),
                        city: city.clone(),
                        from: before,
                        to: b.tier,
                        runs: b.runs,
                    }
                    .publish(&env);
                }
                b
            }
            None => {
                // Yeni şehir: rozet yaratılır ve şehir listesine eklenir.
                let ckey = DataKey::Cities(runner.clone());
                let mut cities: Vec<String> = env
                    .storage()
                    .persistent()
                    .get(&ckey)
                    .unwrap_or(Vec::new(&env));
                cities.push_back(city.clone());
                env.storage().persistent().set(&ckey, &cities);
                env.storage().persistent().extend_ttl(&ckey, BUMP, LIFE);

                let b = Badge {
                    city: city.clone(),
                    runs: 1,
                    total_distance_m: distance_m as u64,
                    tier: Tier::Common,
                    first_earned: now,
                    last_run: now,
                };
                BadgeEarned {
                    runner: runner.clone(),
                    city: city.clone(),
                    tier: b.tier,
                }
                .publish(&env);
                b
            }
        };

        let tier = badge.tier;
        env.storage().persistent().set(&key, &badge);
        env.storage().persistent().extend_ttl(&key, BUMP, LIFE);
        Ok(tier)
    }

    pub fn get_badge(env: Env, runner: Address, city: String) -> Result<Badge, Error> {
        let key = DataKey::Badge(runner, city);
        let b: Badge = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::BadgeNotFound)?;
        env.storage().persistent().extend_ttl(&key, BUMP, LIFE);
        Ok(b)
    }

    /// Koşucunun rozet kazandığı tüm şehirler.
    pub fn get_cities(env: Env, runner: Address) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&DataKey::Cities(runner))
            .unwrap_or(Vec::new(&env))
    }

    /// Koleksiyonun tamamı — profil sayfası bunu tek çağrıda okur.
    pub fn get_collection(env: Env, runner: Address) -> Vec<Badge> {
        let cities: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::Cities(runner.clone()))
            .unwrap_or(Vec::new(&env));

        let mut out = Vec::new(&env);
        for city in cities.iter() {
            if let Some(b) = env
                .storage()
                .persistent()
                .get::<_, Badge>(&DataKey::Badge(runner.clone(), city))
            {
                out.push_back(b);
            }
        }
        out
    }

    /// Yönetimsel: attestor anahtarı değişirse minter'ı günceller.
    pub fn set_minter(env: Env, new_minter: Address) -> Result<(), Error> {
        let mut cfg: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;
        cfg.admin.require_auth();
        cfg.minter = new_minter;
        env.storage().instance().set(&DataKey::Config, &cfg);
        env.storage().instance().extend_ttl(BUMP, LIFE);
        Ok(())
    }
}

mod test;
