# Technical notes

This file records the findings **verified against live testnet** during
development. Every address, every response shape and every number here came from
a real call — none of it was copied from a specification or a doc site.

It serves two purposes: saving time for anyone walking the same path, and
remembering six months from now why a decision was made the way it was.

---

## 1. Anchor verification — `tr-mock-anchor.fly.dev`

### No SEP-24, but SEP-6

There is **no** `TRANSFER_SERVER_SEP0024` key in `stellar.toml`, and
`/sep24/info` returns **404**. What it actually speaks:

```
SEP-1   .well-known/stellar.toml   discovery
SEP-10  /auth                      authentication with the wallet key
SEP-12  /sep12/customer            KYC (auto-approved in this sandbox)
SEP-38  /sep38/quote               rate lock
SEP-6   /sep6/*                    deposit / withdrawal
```

This is not a technical detail but a **product decision**: SEP-24 opens the
anchor's own interface in a popup, while SEP-6 is programmatic, which means we
draw the deposit and withdrawal screens ourselves. The user never leaves the app
and the ramp can be embedded **inside** the join flow.

### Discovered endpoints

```
WEB_AUTH_ENDPOINT   https://tr-mock-anchor.fly.dev/auth
TRANSFER_SERVER     https://tr-mock-anchor.fly.dev/sep6
KYC_SERVER          https://tr-mock-anchor.fly.dev/sep12
ANCHOR_QUOTE_SERVER https://tr-mock-anchor.fly.dev/sep38
SIGNING_KEY         GDXYO6FJCNXZEWGXD54GT76FGFYLOLSOGSOJLNQ6WGHCGEQPO7NTE73M
USDC issuer         GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
treasury            GCLCZEQZ2THTEDAOFI66LACNPLY4OBKN7VKLEZFMBIHYKYQOW2W7T3Z6
```

- **CORS `*`** → callable directly from the browser; no server-side proxy needed
- Rate source: Reflector oracle, 50 bps spread
- Limits: deposits **50–3000 TRY**, **0.5–300 USDC** per transaction, 0.5% fee

### Verified call shapes

**SEP-10** — `GET /auth?account=G…` → `{transaction, network_passphrase}` → sign
in the wallet → `POST /auth {transaction}` → `{token}`.
The challenge's source must match `SIGNING_KEY`; if it does not, a fake anchor is
getting you to sign for it. The JWT is valid for ~24 hours.

**SEP-38** — `POST /sep38/quote`
```json
{ "sell_asset": "iso4217:TRY",
  "buy_asset": "stellar:USDC:<ISSUER>",
  "sell_amount": "500",
  "context": "sep6",
  "sell_delivery_method": "bank_account" }
```
Measured: **500 TRY → 10.198 USDC**, fee 2.49 TRY.

> ⚠ `total_price` comes back **in the direction of the asset being sold**. On a
> deposit (you sell TRY) it is 48.54, as expected. On a withdrawal (you sell
> USDC) the same field returns **0.0206**, because it is now dollars per lira.
> Printed to the screen as-is, the user sees "1 USDC = 0.02 ₺". The rate has to
> be computed as `buy_amount / sell_amount`.

**SEP-6 deposit** — `GET /sep6/deposit-exchange`
> ⚠ `destination_asset` is the **asset code only**: `USDC`.
> The `stellar:USDC:G…` form is rejected.
```
destination_asset=USDC & source_asset=iso4217:TRY & amount=500
& account=G… & type=bank_account & quote_id=qt_…
```
Returns: the IBAN (`bank_account_number`) plus the reference code for the
transfer description (`external_transfer_memo`).

**Play the bank (sandbox)** — `POST /sep6/tx/{id}/simulate-bank-transfer`
> ⚠ `POST /sep6/simulate-bank-transfer` is **404**; the path is `/sep6/tx/{id}/…`.

**SEP-6 withdrawal** — `GET /sep6/withdraw-exchange?source_asset=USDC&…`
Returns: the treasury `account_id` plus a `memo` (**type: `id`**).
> ⚠ A payment sent with a text memo does not match. `Memo.id()` must be used.

### Moving to mainnet
The endpoint shapes and the integration code **do not change**. What changes: the
network passphrase, the home domain, and the simulated legs becoming real.
Mainnet USDC issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

---

## 2. DeFindex and the testnet asset mismatch

### Testnet addresses (paltalabs/defindex → `public/testnet.contracts.json`)
```
factory              CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32
usdc_paltalabs_vault CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN
USDC_blend_strategy  CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY
soroswap_router      CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
```

### The vault interface — callable contract to contract
```rust
deposit(amounts_desired: Vec<i128>, amounts_min: Vec<i128>,
        from: Address, invest: bool)
    -> (Vec<i128>, i128 /*shares*/, Option<…>)
withdraw(withdraw_shares: i128, min_amounts_out: Vec<i128>,
         from: Address) -> Vec<i128>
get_assets() -> Vec<AssetStrategySet>
```
Because it takes `from: Address`, `runforrest_challenge` can call it with its own
address.

### ⚠ Two different "USDC"s

| | Contract ID |
|---|---|
| The anchor's USDC (Circle) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| The off-the-shelf DeFindex vault's USDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

Same ticker, **different asset** (issuer `GBBD47IF…` vs `GATALTGT…`). A bridge
was looked for, and all three routes were ruled out:

| Route | Measurement |
|---|---|
| Classic DEX path payment | 100 USDC → **0.0067 USDC** (no liquidity) |
| Soroswap pair `CB5RQPRO…` | Exists, but reserves ~24/~105 → **79% loss** on a 10 USDC swap |
| Blend testnet pool `fixed_xlm_usdc` | Reserves are XLM + Blend-USDC; **Circle USDC is in no Blend testnet pool** |

> This is not specific to DeFindex: on testnet there is no DeFi infrastructure
> that accepts the anchor's Circle USDC. Whichever partner were chosen, the yield
> leg is blocked on testnet.

### ⚠ The factory now rejects an empty strategy set

Our vault was created with an empty strategy set (`strategies: []`) and works.
The same call later began to **trap in the constructor**:

```
HostError: Error(Context, InvalidAction)
  "constructor invocation has failed with error"
  VM call trapped: UnreachableCodeReached  __constructor
```

Test matrix: with identical parameters, a call **with a strategy** succeeds and a
call **with an empty set** fails — including with the exact name and symbol that
worked before. So DeFindex updated the vault WASM and the new constructor
requires at least one strategy.

Consequence: the existing vault keeps working because it was created with the old
WASM, but **a new vault cannot be created** for Circle USDC — there is no
strategy that accepts that asset, which is precisely the mismatch above.

### Decision
**Our own vault** was created from the factory, for the anchor's Circle USDC,
with an empty strategy set.

**What is real:** custody, share accounting, and contract-to-contract
`deposit`/`withdraw` — all verified on chain.
**What is not:** yield, because no testnet strategy accepts this asset.

On mainnet the problem disappears: DeFindex's own mainnet configuration lists
Circle USDC (`CCW67TSZ…`) as a Blend `fixed` pool asset. The same vault gains a
yield strategy with no contract change.

**The demo claims no yield.**

---

## 3. Two bugs the live chain caught

Both passed the local tests and would never have shown up against a fake vault.

### The vault's minimum-liquidity lock → funds would be stranded

```
deposit returned : 100000000 shares
real balance     :  99999000 shares   ← 1000 stroops short
```

DeFindex withholds minimum liquidity on the first deposit (like Uniswap's
`MINIMUM_LIQUIDITY`). Had the contract recorded the returned value, `finalize()`
would have tried to withdraw shares it did not own and reverted — **every
challenge would become permanently impossible to close, with the funds stuck in
the vault.**

**Fix:** the returned value is ignored; the real share balance is measured before
and after the deposit and the delta is recorded. On top of that, `vault_withdraw`
caps the recorded shares at the real balance, so finalize can never lock up.
Regression test: `recorded_shares_match_the_real_vault_balance`.

### Soroban enums decode as arrays → a silent failure

```
scValToNative(Status::Finalized) → ["Finalized"]   (not "Finalized")
scValToNative(Tier::Common)      → ["Common"]
```

`status === "Finalized"` is **always false**, and `TIER_META[badge.tier]` is
**undefined**. Nothing throws — the leaderboard simply never shows results, and
the mint page breaks on a missing gradient.

**Fix:** an `unwrapEnum()` normalisation in the read layer.

---

## 4. Frontend findings

### The GPS accuracy filter was holding distance at zero
Discarding readings above the accuracy threshold **outright** is tempting but
wrong: on a desktop the position comes from Wi-Fi, so accuracy is usually worse
than 100 m and no point is ever recorded. The UI says "GPS active" while distance
stays at 0 m, the map never reaches the user, and no reason is given.

**The right behaviour:** the position is drawn on the map **in all cases**; the
threshold filters **distance accumulation** only, so jumping readings cannot
invent kilometres. Accuracy is shown to the user: `±12m` on the badge, and an
uncertainty circle on the map.

### The map base layer
CARTO's `dark_all` layer burns an `API KEY REQUIRED` watermark **into** the tile
image when used without a key — and returns HTTP 200, so the code sees no error
either. Three alternatives were compared visually:

| Source | Result |
|---|---|
| CARTO dark_all | Watermark inside the tile |
| Esri World Dark Gray | Clean but washed out, little detail |
| **OSM + CSS darkening** | ✅ Clean, keyless, detailed |

The filter is applied **only** to `.leaflet-tile-pane`; the route and markers keep
their real colours. The OSM licence requires attribution — it has been added.

> Production note: OSM's tile server is not built for heavy use. At real volume
> you need your own tile source or a keyed provider.

---

## 5. Environment notes (Windows)

**Smart App Control** blocks the unsigned build-script executables cargo produces
(`os error 4551`). Moving `CARGO_TARGET_DIR` does not help; it is deterministic.
The fix: the contracts are compiled **inside WSL2**. Smart App Control was not
turned off — per Microsoft, that is an irreversible action.

**Paths with Turkish characters:** the mingw linker cannot handle a path such as
`Masaüstü`. To compile on Windows, `CARGO_TARGET_DIR` must be ASCII. There is no
such problem under WSL.

**Dependency break:** `soroban-env-host 23.0.1` does not compile against
`ed25519-dalek 3.0.0`. Pinned with
`cargo update -p ed25519-dalek@3.0.0 --precise 2.2.0` (recorded in `Cargo.lock`).

---

## 6. End-to-end verification log

```
anchor deposit    3 × 1500 TRY → 91.78 USDC delivered on chain
anchor withdrawal 5 USDC → 242.70 TRY paid out
                  balance fell by exactly 5.0000
                  pending_user_transfer_start → completed

lifecycle         create → join → record_progress → finalize → claim
                  start 81.7824086 USDC
                  end   81.7824086 USDC   (10 paid in, 10 won)
                  left in the contract: 0

attestation       impossible pace → rejected with 422
                  valid run → badge written to chain and read back

GPS (simulated)   Kadıköy–Moda, 8 points → 655 m measured
                  accuracy ±12 m shown in the UI
```

The verification scripts are under [`scripts/`](../scripts/); they run against
live testnet and print the values they find.
