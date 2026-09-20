# Vercel'e yayınlama

Uygulama `web/` alt dizininde. Vercel'in **kök dizini oraya** bakması gerekiyor —
tek dikkat edilecek nokta bu.

---

## Yol 1 — CLI (hızlı)

```bash
vercel login          # tarayıcı açılır, giriş yapın
cd web
vercel --prod
```

İlk çalıştırmada birkaç soru sorar:

| Soru | Cevap |
|---|---|
| Set up and deploy? | **Y** |
| Which scope? | kendi hesabınız |
| Link to existing project? | **N** |
| Project name? | `runforrest` |
| In which directory is your code located? | **`./`** (zaten `web/` içindesiniz) |
| Auto-detected settings? | **Y** (Next.js) |

---

## Yol 2 — GitHub bağlantısı (her push'ta otomatik deploy)

1. [vercel.com/new](https://vercel.com/new) → repoyu seçin
2. **Root Directory** → `web` olarak ayarlayın ← *bu adım atlanırsa build başarısız olur*
3. Framework: Next.js (otomatik algılanır)
4. Aşağıdaki ortam değişkenlerini girin → Deploy

---

## Ortam değişkenleri

### Zorunlu — bunlar olmadan da site açılır ama koşu zincire yazılmaz

| Değişken | Değer |
|---|---|
| `ATTESTOR_SECRET` | Koşu mesafesini imzalayan **testnet secret key** (`S…`) |

> **Sunucu tarafı.** `NEXT_PUBLIC_` öneki **koymayın**. Tarayıcıya sızarsa
> herkes istediği mesafeyi zincire yazabilir.
>
> Kontratlar bu attestor adresi `__constructor`'da sabitlenmiş olarak deploy
> edildi ve config değiştirilemez. Yani şu an yalnızca mevcut anahtar
> çalışıyor; üretimde ayrı bir anahtar istenirse `runforrest_challenge`
> yeniden deploy edilmeli.

### Opsiyonel — koşu geçmişi ve yarışma üstverisi

| Değişken | Not |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Boş bırakılırsa rota geçmişi kapalı kalır |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tarayıcıda açığa çıkması tasarım gereği; koruma RLS'te |

Tablolar için: `web/scripts/setup.sql` → Supabase SQL Editor.
Durum kontrolü: yayın sonrası `https://<alan-adı>/api/setup-db`

### Varsayılanı olanlar — girmezseniz koddaki değer kullanılır

| Değişken | Varsayılan |
|---|---|
| `NEXT_PUBLIC_RUNFORREST_CHALLENGE_ID` | `CAN4QVZURUX6OLBFC7IH2HQHQDUJDD72UBGJLXR67BKACWBQF4JVUWCM` |
| `NEXT_PUBLIC_RUNFORREST_BADGE_ID` | `CBEMQGDLL2KNMBSINUSQM7QXMKAOMFIJDFQL27F3ZEWSRYA75WB3VCU6` |
| `NEXT_PUBLIC_RUNFORREST_VAULT_ID` | `CCHEMDA647SX2RPQ4FYQ3HLDXLVSREQSIAWXVQ2AYRMEHPQLVSGXASI7` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

---

## Yayın sonrası kontrol listesi

1. **Ana sayfa açılıyor mu** — `/`
2. **Zincir okumaları** — `/leaderboard` yarışmayı gösteriyor mu
   (tarayıcıdan Soroban RPC'ye doğrudan çağrı yapılır; CORS açıktır)
3. **Anchor** — `/profile` → *TRY ile yükle*; anchor `access-control-allow-origin: *`
   verdiği için proxy gerekmez, doğrudan tarayıcıdan çağrılır
4. **Attestation** — bir koşu kaydedin; `ATTESTOR_SECRET` yoksa 503 ve açıklayıcı
   mesaj döner, sayfa çökmez
5. **Supabase** — `/api/setup-db` → `"ready": true`
6. **Cüzdan** — Freighter **Testnet**'te olmalı; yeni hesap ise arayüz sırayla
   *hesabı etkinleştir* → *USDC izni* adımlarını sunar

---

## Bilinen kısıtlar

**GPS için HTTPS gerekir.** Vercel zaten HTTPS veriyor, sorun yok — ama
`http://` üzerinden servis edilen bir kopyada `navigator.geolocation` çalışmaz.

**Harita karoları OpenStreetMap'ten geliyor.** Ücretsiz ama yoğun kullanım
için tasarlanmadı; gerçek trafik olursa kendi karo kaynağınıza geçin.

**Anchor bir sandbox.** Banka bacağı simüle, KYC otomatik onaylı. Stellar
bacağı gerçek testnet USDC'si.
