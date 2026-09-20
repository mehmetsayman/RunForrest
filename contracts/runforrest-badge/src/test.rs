#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env};

struct Fixture<'a> {
    env: Env,
    client: RunForrestBadgeClient<'a>,
    admin: Address,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let minter = Address::generate(&env);
    let id = env.register(RunForrestBadge, (admin.clone(), minter.clone()));

    Fixture {
        client: RunForrestBadgeClient::new(&env, &id),
        admin,
        env,
    }
}

fn city(f: &Fixture, name: &str) -> String {
    String::from_str(&f.env, name)
}

#[test]
fn first_run_creates_a_common_badge() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let istanbul = city(&f, "Istanbul");

    let tier = f.client.record_run(&alice, &istanbul, &5000);
    assert_eq!(tier, Tier::Common);

    let b = f.client.get_badge(&alice, &istanbul);
    assert_eq!(b.runs, 1);
    assert_eq!(b.total_distance_m, 5000);
    assert_eq!(b.tier, Tier::Common);
}

#[test]
fn distance_accumulates_across_runs() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let c = city(&f, "Ankara");

    f.client.record_run(&alice, &c, &5000);
    f.client.record_run(&alice, &c, &7500);

    let b = f.client.get_badge(&alice, &c);
    assert_eq!(b.runs, 2);
    assert_eq!(b.total_distance_m, 12_500);
}

#[test]
fn tiers_follow_the_run_count_table() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let c = city(&f, "Izmir");

    // 1–5 Common
    for _ in 0..5 {
        f.client.record_run(&alice, &c, &1000);
    }
    assert_eq!(f.client.get_badge(&alice, &c).tier, Tier::Common);

    // 6. kosu -> Rare
    f.client.record_run(&alice, &c, &1000);
    assert_eq!(f.client.get_badge(&alice, &c).tier, Tier::Rare);

    // 16. -> Epic
    for _ in 7..=16 {
        f.client.record_run(&alice, &c, &1000);
    }
    let b = f.client.get_badge(&alice, &c);
    assert_eq!(b.runs, 16);
    assert_eq!(b.tier, Tier::Epic);

    // 26. -> Legendary
    for _ in 17..=26 {
        f.client.record_run(&alice, &c, &1000);
    }
    let b = f.client.get_badge(&alice, &c);
    assert_eq!(b.runs, 26);
    assert_eq!(b.tier, Tier::Legendary);
}

#[test]
fn each_city_is_a_separate_badge() {
    let f = setup();
    let alice = Address::generate(&f.env);

    f.client.record_run(&alice, &city(&f, "Istanbul"), &5000);
    f.client.record_run(&alice, &city(&f, "Canakkale"), &3000);
    f.client.record_run(&alice, &city(&f, "Istanbul"), &4000);

    let cities = f.client.get_cities(&alice);
    assert_eq!(cities.len(), 2);

    assert_eq!(f.client.get_badge(&alice, &city(&f, "Istanbul")).runs, 2);
    assert_eq!(f.client.get_badge(&alice, &city(&f, "Canakkale")).runs, 1);
}

#[test]
fn collection_returns_every_badge() {
    let f = setup();
    let alice = Address::generate(&f.env);

    for name in ["Istanbul", "Ankara", "Izmir"] {
        f.client.record_run(&alice, &city(&f, name), &2000);
    }

    let col = f.client.get_collection(&alice);
    assert_eq!(col.len(), 3);
}

#[test]
fn badges_of_different_runners_do_not_mix() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let bob = Address::generate(&f.env);
    let c = city(&f, "Bursa");

    f.client.record_run(&alice, &c, &5000);
    f.client.record_run(&alice, &c, &5000);
    f.client.record_run(&bob, &c, &5000);

    assert_eq!(f.client.get_badge(&alice, &c).runs, 2);
    assert_eq!(f.client.get_badge(&bob, &c).runs, 1);
    assert_eq!(f.client.get_cities(&bob).len(), 1);
}

#[test]
fn unknown_badge_is_an_error_not_a_default() {
    let f = setup();
    let stranger = Address::generate(&f.env);
    assert_eq!(
        f.client.try_get_badge(&stranger, &city(&f, "Nowhere")),
        Err(Ok(Error::BadgeNotFound))
    );
}

#[test]
fn zero_distance_is_rejected() {
    let f = setup();
    let alice = Address::generate(&f.env);
    assert_eq!(
        f.client.try_record_run(&alice, &city(&f, "Istanbul"), &0),
        Err(Ok(Error::InvalidDistance))
    );
}

#[test]
fn minter_can_be_rotated_by_admin() {
    let f = setup();
    let new_minter = Address::generate(&f.env);

    f.client.set_minter(&new_minter);
    assert_eq!(f.client.config().minter, new_minter);
    assert_eq!(f.client.config().admin, f.admin);
}

/// Badges are soulbound: the contract has no transfer surface.
/// This test documents the intent — none of the calls below would compile,
/// because no such functions are defined:
///   client.transfer(...) / client.approve(...) / client.burn(...)
#[test]
fn badges_are_soulbound_by_absence_of_transfer() {
    let f = setup();
    let alice = Address::generate(&f.env);
    let c = city(&f, "Istanbul");
    f.client.record_run(&alice, &c, &5000);

    // A badge is only readable on its owner; there is no entry point that
    // would make a transfer possible.
    assert_eq!(f.client.get_badge(&alice, &c).runs, 1);
}
