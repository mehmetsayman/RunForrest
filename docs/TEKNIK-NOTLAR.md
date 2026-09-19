# Teknik notlar

Bu dosya geliştirme sırasında **canlı testnet'e karşı doğrulanmış** bulguları
tutar. Buradaki her adres, her yanıt şekli ve her sayı gerçek bir çağrıdan
geldi — spesifikasyondan ya da dokümandan kopyalanmadı.

Amacı iki yönlü: aynı yolu yürüyecek birine zaman kazandırmak, ve bir
kararın neden öyle verildiğini altı ay sonra hatırlatmak.

---

## 1. Anchor doğrulaması — `tr-mock-anchor.fly.dev`

### SEP-24 yok, SEP-6 var

`stellar.toml` içinde `TRANSFER_SERVER_SEP0024` anahtarı **bulunmuyor** ve
`/sep24/info` **404** dönüyor. Konuşulan hat:

```
SEP-1   .well-known/stellar.toml   keşif
SEP-10  /auth                      cüzdan anahtarıyla kimlik
SEP-12  /sep12/customer            KYC (bu sandbox'ta otomatik onay)
SEP-38  /sep38/quote               kur kilidi
SEP-6   /sep6/*                    para yatırma / çekme
```

Bu teknik bir ayrıntı değil, **ürün kararı**: SEP-24 anchor'ın kendi
arayüzünü bir popup'ta açar; SEP-6 programatiktir, yani yatırma/çekme
ekranını biz çiziyoruz. Kullanıcı uygulamadan hiç çıkmıyor ve ramp,
katılım akışının **içine** gömülebiliyor.

### Keşfedilen uç noktalar

```
WEB_AUTH_ENDPOINT   https://tr-mock-anchor.fly.dev/auth
TRANSFER_SERVER     https://tr-mock-anchor.fly.dev/sep6
KYC_SERVER          https://tr-mock-anchor.fly.dev/sep12
ANCHOR_QUOTE_SERVER https://tr-mock-anchor.fly.dev/sep38
SIGNING_KEY         GDXYO6FJCNXZEWGXD54GT76FGFYLOLSOGSOJLNQ6WGHCGEQPO7NTE73M
USDC issuer         GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
treasury            GCLCZEQZ2THTEDAOFI66LACNPLY4OBKN7VKLEZFMBIHYKYQOW2W7T3Z6
```

- **CORS `*`** → tarayıcıdan doğrudan çağrılabiliyor, sunucu tarafı proxy gerekmiyor
- Kur kaynağı: Reflector oracle, 50 bps spread
- Limitler: on-ramp **50–3000 TRY**, işlem başına **0.5–300 USDC**, komisyon %0.5

### Doğrulanmış çağrı şekilleri

**SEP-10** — `GET /auth?account=G…` → `{transaction, network_passphrase}` →
cüzdanda imzala → `POST /auth {transaction}` → `{token}`.
Challenge'ın kaynağı `SIGNING_KEY` ile eşleşmeli; eşleşmiyorsa sahte bir
anchor size imzalatıyor demektir. JWT ~24 saat geçerli.

**SEP-38** — `POST /sep38/quote`
```json
{ "sell_asset": "iso4217:TRY",
  "buy_asset": "stellar:USDC:<ISSUER>",
  "sell_amount": "500",
  "context": "sep6",
  "sell_delivery_method": "bank_account" }
```
Ölçüm: **500 TRY → 10.198 USDC**, komisyon 2.49 TRY.

> ⚠ `total_price` **satılan varlığın yönünde** geliyor. Yatırmada (TRY
> satıyorsun) 48.54 — beklenen. Çekmede (USDC satıyorsun) aynı alan
> **0.0206** dönüyor, çünkü artık lira başına dolar. Olduğu gibi ekrana
> basılırsa kullanıcı "1 USDC = 0.02 ₺" görür. Kur `buy_amount / sell_amount`
> ile hesaplanmalı.

**SEP-6 yatırma** — `GET /sep6/deposit-exchange`
> ⚠ `destination_asset` **yalnızca varlık kodu**: `USDC`.
> `stellar:USDC:G…` formatı reddediliyor.
```
destination_asset=USDC & source_asset=iso4217:TRY & amount=500
& account=G… & type=bank_account & quote_id=qt_…
```
Dönüş: IBAN (`bank_account_number`) + havale açıklamasına yazılacak
referans kodu (`external_transfer_memo`).

**Bankayı oynat (sandbox)** — `POST /sep6/tx/{id}/simulate-bank-transfer`
> ⚠ `POST /sep6/simulate-bank-transfer` **404**; yol `/sep6/tx/{id}/…` şeklinde.

**SEP-6 çekme** — `GET /sep6/withdraw-exchange?source_asset=USDC&…`
Dönüş: hazine `account_id` + `memo` (**tip: `id`**).
> ⚠ Metin memo ile gönderilen ödeme eşleşmez. `Memo.id()` kullanılmalı.

### Mainnet'e taşınırken
Uç nokta şekilleri ve entegrasyon kodu **değişmiyor**. Değişen: network
passphrase, home domain, ve simüle bacakların gerçekleşmesi.
Mainnet USDC issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

---

## 2. DeFindex ve testnet varlık uyuşmazlığı

### Testnet adresleri (paltalabs/defindex → `public/testnet.contracts.json`)
```
factory              CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32
usdc_paltalabs_vault CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN
USDC_blend_strategy  CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY
soroswap_router      CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
```

### Vault arayüzü — kontrattan kontrata çağrılabilir
```rust
deposit(amounts_desired: Vec<i128>, amounts_min: Vec<i128>,
        from: Address, invest: bool)
    -> (Vec<i128>, i128 /*shares*/, Option<…>)
withdraw(withdraw_shares: i128, min_amounts_out: Vec<i128>,
         from: Address) -> Vec<i128>
get_assets() -> Vec<AssetStrategySet>
```
`from: Address` aldığı için `runforrest_challenge` kendi adresiyle çağırabiliyor.

### ⚠ İki farklı "USDC"

| | Contract ID |
|---|---|
| Anchor'ın USDC'si (Circle) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Hazır DeFindex vault'unun USDC'si | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

Aynı ticker, **farklı varlık** (issuer `GBBD47IF…` vs `GATALTGT…`).
Köprü arandı, üçü de elendi:

| Yol | Ölçüm |
|---|---|
| Klasik DEX path payment | 100 USDC → **0.0067 USDC** (likidite yok) |
| Soroswap pair `CB5RQPRO…` | Var, ama rezerv ~24/~105 → 10 USDC takasta **%79 kayıp** |
| Blend testnet havuzu `fixed_xlm_usdc` | Rezervler XLM + Blend-USDC; **Circle USDC hiçbir Blend testnet havuzunda yok** |

> Bu DeFindex'e özgü değil: testnet'te anchor'ın Circle USDC'sini kabul eden
> hiçbir DeFi altyapısı yok. Hangi partner seçilirse seçilsin getiri bacağı
> testnet'te bloke.

### ⚠ Factory artık boş strateji setini reddediyor

Vault'umuz boş strateji setiyle (`strategies: []`) oluşturulmuştu ve çalışıyor.
Sonradan aynı çağrı **constructor'da trap** etmeye başladı:

```
HostError: Error(Context, InvalidAction)
  "constructor invocation has failed with error"
  VM call trapped: UnreachableCodeReached  __constructor
```

Test matrisi: aynı parametrelerle **stratejili** çağrı başarılı, **boş setli**
çağrı — daha önce çalışan isim/sembol dahil — başarısız. Yani DeFindex vault
WASM'ını güncelledi ve yeni constructor en az bir strateji istiyor.

Sonuç: mevcut vault eski WASM'la oluşturulduğu için çalışmaya devam ediyor,
ama Circle USDC için **yeni bir vault oluşturulamıyor** — o varlığı kabul eden
bir strateji yok (yukarıdaki uyuşmazlığın ta kendisi).

### Karar
Factory'den **kendi vault'umuz** oluşturuldu, anchor'ın Circle USDC'si için,
boş strateji setiyle.

**Gerçek olan:** custody, share muhasebesi, kontrattan kontrata
`deposit`/`withdraw` — hepsi zincirde doğrulandı.
**Olmayan:** getiri, çünkü bu varlığı kabul eden testnet stratejisi yok.

Mainnet'te bu sorun ortadan kalkıyor: DeFindex'in kendi mainnet konfigürasyonu
Circle USDC'yi (`CCW67TSZ…`) Blend `fixed` havuzu varlığı olarak listeliyor.
Aynı vault, kontrat değişikliği olmadan getiri stratejisi alıyor.

**Demoda getiri iddia edilmiyor.**

---

## 3. Canlı zincirin yakaladığı iki hata

İkisi de yerel testlerden geçiyordu ve sahte bir vault'la asla görünmezdi.

### Vault minimum likidite kilidi → fonlar kilitlenirdi

```
deposit dönüşü  : 100000000 share
gerçek bakiye   :  99999000 share   ← 1000 stroop fark
```

DeFindex ilk yatırımda minimum likidite kilitliyor (Uniswap'in
`MINIMUM_LIQUIDITY`'si gibi). Kontrat dönüş değerini kaydetseydi `finalize()`
sahip olmadığı kadar share çekmeye çalışıp revert edecekti — **her yarışma
kalıcı olarak kapatılamaz hale gelir, fonlar vault'ta sıkışırdı.**

**Düzeltme:** dönüş değeri yok sayılıyor; yatırım öncesi/sonrası gerçek share
bakiyesi ölçülüp farkı kaydediliyor. Ayrıca `vault_withdraw` kayıtlı share'i
gerçek bakiyeyle sınırlıyor — finalize hiçbir koşulda kilitlenmesin diye.
Regresyon testi: `recorded_shares_match_the_real_vault_balance`.

### Soroban enum'ları dizi olarak çözülüyor → sessiz hata

```
scValToNative(Status::Finalized) → ["Finalized"]   ("Finalized" değil)
scValToNative(Tier::Common)      → ["Common"]
```

`status === "Finalized"` **her zaman false**; `TIER_META[badge.tier]`
**undefined**. Hata fırlatmıyor — leaderboard sonuçları hiç göstermiyor,
mint sayfası eksik gradyanda çöküyor.

**Düzeltme:** okuma katmanında `unwrapEnum()` normalizasyonu.

---

## 4. Frontend bulguları

### GPS doğruluk filtresi mesafeyi sıfırda tutuyordu
Doğruluk eşiğini aşan okumaları **tamamen atmak** cazip ama yanlış:
masaüstünde konum Wi-Fi'dan geldiği için doğruluk çoğu zaman 100m üstünde
oluyor ve hiçbir nokta kaydedilmiyor. Arayüz "GPS aktif" derken mesafe 0m'de
kalır, harita kullanıcıya hiç gelmez, sebep de söylenmez.

**Doğrusu:** konum **her durumda** haritaya işlenir; eşik yalnızca **mesafe
birikimini** süzer (sıçrayan okumalar sahte km üretmesin diye). Doğruluk
kullanıcıya gösterilir: rozette `±12m`, haritada belirsizlik dairesi.

### Harita altlığı
CARTO'nun `dark_all` altlığı anahtarsız kullanımda karo görselinin **içine**
`API KEY REQUIRED` filigranı basıyor — HTTP 200 döndüğü için kod hata da
görmüyor. Üç alternatif görsel olarak karşılaştırıldı:

| Kaynak | Sonuç |
|---|---|
| CARTO dark_all | Filigran karonun içinde |
| Esri World Dark Gray | Temiz ama soluk, detay az |
| **OSM + CSS koyulaştırma** | ✅ Temiz, anahtarsız, detaylı |

Filtre **yalnızca** `.leaflet-tile-pane`'e uygulanıyor; rota ve işaretçiler
gerçek renklerinde kalıyor. OSM lisansı atıf zorunlu kılıyor — eklendi.

> Üretim notu: OSM'in karo sunucusu yoğun kullanım için tasarlanmadı.
> Gerçek hacimde kendi karo kaynağı ya da anahtarlı sağlayıcı gerekir.

---

## 5. Ortam notları (Windows)

**Smart App Control** cargo'nun ürettiği imzasız build-script çalıştırılabilirlerini
engelliyor (`os error 4551`). `CARGO_TARGET_DIR`'ı taşımak çözmüyor; deterministik.
Çözüm: kontratlar **WSL2 içinde** derleniyor. Smart App Control kapatılmadı —
Microsoft'a göre bu geri alınamaz bir işlem.

**Türkçe karakterli yol:** mingw linker `Masaüstü` gibi yolları işleyemiyor.
Windows'ta derlenecekse `CARGO_TARGET_DIR` ASCII olmalı. WSL'de sorun yok.

**Bağımlılık kırılması:** `soroban-env-host 23.0.1`, `ed25519-dalek 3.0.0` ile
derlenmiyor. `cargo update -p ed25519-dalek@3.0.0 --precise 2.2.0` ile
sabitlendi (`Cargo.lock`'ta).

---

## 6. Uçtan uca doğrulama kaydı

```
anchor yatırma   3 × 1500 TRY → 91.78 USDC zincire geçti
anchor çekme     5 USDC → 242.70 TRY ödendi
                 bakiye tam 5.0000 düştü
                 pending_user_transfer_start → completed

yaşam döngüsü    create → join → record_progress → finalize → claim
                 başlangıç 81.7824086 USDC
                 bitiş     81.7824086 USDC   (10 ödendi, 10 kazanıldı)
                 kontratta kalan: 0

onaylama         imkânsız tempo → 422 reddedildi
                 geçerli koşu → rozet zincire yazıldı, geri okundu

GPS (simüle)     Kadıköy–Moda, 8 nokta → 655m ölçüldü
                 doğruluk ±12m arayüzde
```

Doğrulama script'leri [`scripts/`](../scripts/) altında; canlı testnet'e karşı
çalışır ve buldukları değerleri ekrana basar.
