# Demo video — seslendirme metni ve çekim planı

Toplam **2 dakika 55 saniye**, dokuz parça.

Her parça ayrı ayrı seslendirilip ayrı çekilecek şekilde yazıldı. Sırayla
ilerleyin: bir parçanın sesini ElevenLabs'te üretin, o parçanın görüntüsünü
çekin, sonrakine geçin. Sonda hepsi arka arkaya eklenir.

**SES** bloğundaki metin olduğu gibi ElevenLabs'e yapıştırılacak olan metindir —
başka hiçbir şey okunmayacak. **GÖRÜNTÜ** bloğu ne çekileceğini anlatır,
okunmaz.

### ElevenLabs ayarları

- Ses tonu: sakin ve bilgi veren, reklam sesi değil. Ürünün tek iddiası
  sayılarının doğrulanabilir olması; heyecanlı bir okuma bunu zayıflatır.
- Hız: varsayılan. Metinler dakikada 150 kelimeye göre yazıldı.
- Kısaltmalar bilerek `S-E-P`, `G-P-S`, `I-B-A-N`, `K-Y-C` diye tireli yazıldı;
  böylece tek kelime gibi okunmuyor. Bu tireleri silmeyin.
- Her parçayı ayrı mp3 olarak indirin, dosya adına parça numarasını verin.

---

## Parça 1 — Problem · 0:00 – 0:18 · **18 saniye**

**SES**

> A runner in Istanbul wants to join a ten dollar distance challenge. Today that
> means finding an exchange, passing K-Y-C, buying crypto, and learning what a
> wallet is. Most people stop at step one. And the prize pool? It sits in the
> organiser's account. You simply trust them.

**GÖRÜNTÜ** — Açılış sayfası, yavaş kaydırma. Hero'dan başlayıp dört sayı
kartında durun: `3 CONTRACTS ON CHAIN · 5 SEP STANDARDS · 24 PASSING TESTS ·
100% POOL HELD ON CHAIN`. Son cümlede "100% POOL HELD ON CHAIN" kartında kalın.

---

## Parça 2 — Ne yaptık · 0:18 – 0:34 · **16 saniye**

**SES**

> RunForrest makes the pool a contract instead of a promise, and the on-ramp a
> bank transfer instead of an exchange. Three Soroban contracts on Stellar
> Testnet. A Turkish lira rail in both directions. Twenty-four passing tests.

**GÖRÜNTÜ** — Leaderboard'a geçin. Ödül havuzu kartı ekranı doldursun: tutar,
koşucu sayısı ve altındaki `The pool is held in a DeFindex vault` satırı net
görünsün. O satıra tıklayıp Stellar Expert'te vault'u bir saniye gösterin.

---

## Parça 3 — Fiat rayı · 0:34 – 1:10 · **36 saniye**

> Bu videonun en önemli parçası. Acele etmeyin, ekranları tam gösterin.

**SES**

> Here is the part we care about most. A runner with no crypto taps Join. They
> are short on USDC, so the deposit sheet opens right there. No redirect. No
> pop-up. They never leave the app. The anchor speaks S-E-P six, which is
> programmatic, so we draw this screen ourselves. Behind it: discovery,
> authentication with the wallet key, K-Y-C, and a firm quote that locks the
> rate. The runner gets an I-B-A-N and a reference code, sends lira from their
> own bank, and USDC lands in their wallet. The join they started finishes by
> itself.

**GÖRÜNTÜ** — Sırayla:
1. `Join · 10 USDC` butonuna basın.
2. Yükleme ekranı açılsın — **sayfa değişmediğini** gösterin, bu önemli.
3. Tutar girin, `Continue`.
4. Freighter imza penceresi çıkınca **kadrajda tutun** ve onaylayın. Jüri
   kullanıcının imzaladığını görmeli, uygulamanın anahtar tuttuğunu değil.
5. IBAN ve referans kodu ekranında iki saniye durun.
6. `I sent the transfer` → işlem tamamlansın.
7. Katılımın kendiliğinden tamamlanıp havuzun arttığını gösterin.

---

## Parça 4 — Strava'dan içe aktarma · 1:10 – 1:32 · **22 saniye**

**SES**

> Most runners already have years of history somewhere else. So we import it.
> Open any activity in Strava, export the G-P-X file, and drop it here.
> RunForrest reads every track point: the route, the distance, the pace, the
> elevation. The map draws the run before anything touches the chain.

**GÖRÜNTÜ** — `/run` → `Upload File` sekmesi. Alttaki `How to export GPX`
kartında **Strava — Open activity → ⋯ → Export GPX** satırını gösterin. Sonra
Strava'dan indirdiğiniz `.gpx` dosyasını sürükleyip bırakın. Rota haritaya
çizilsin; mesafe, süre, tempo ve yükselti kartlarını gösterin.

> Gerçek bir Strava koşusu kullanın. Uydurma dosya kullanmayın — jüri rotanın
> gerçek bir şehirde olduğunu görüyor.

---

## Parça 5 — Canlı GPS · 1:32 – 1:52 · **20 saniye**

**SES**

> Or track it live. The map follows your position, and the circle around it is
> the accuracy of the reading. A weak signal still shows where you are, but it
> does not count toward distance. Jumping readings would invent kilometres, and
> invented kilometres would be worth money here.

**GÖRÜNTÜ** — `Live GPS` sekmesi → `Start Running`. Telefonda, dışarıda, konum
izni verilmiş halde çekin. Gösterilecekler:
- Haritanın konumu takip etmesi
- Konumun etrafındaki **doğruluk dairesi** (`±12m` rozeti)
- Haritayı parmakla kaydırınca takibin durması, `merkeze al` ile dönmesi

> Bu parça masaüstünde ikna edici olmuyor: Wi-Fi konumu 100 metrenin üstünde
> doğruluk veriyor ve mesafe saymıyor. Telefonda ve açık havada çekin.

---

## Parça 6 — Zincire yazma · 1:52 – 2:10 · **18 saniye**

**SES**

> Finish, confirm the city, and save. The distance is signed by the attestor and
> written to the challenge contract. The city badge is minted in the same step.
> Both are transactions you can open in a block explorer.

**GÖRÜNTÜ** — Koşuyu bitirin → `City you ran in` alanında şehir onayı →
`Save and write to Stellar`. `Written to chain` durumu ve işlem hash'leri
görünsün. Hash'lerden birine tıklayıp Stellar Expert'te açın. Sonra `/mint`
sayfasında rozeti gösterin.

---

## Parça 7 — Ödül ve nakde çevirme · 2:10 – 2:30 · **20 saniye**

**SES**

> When the window closes, anyone can finalise. Not the organiser. Anyone. The
> split is fixed in the contract: fifty, thirty, twenty. And if nobody ran at
> all, the entry fees are refunded, so the pool can never be stranded. The winner
> claims, and the money leaves the way it came. USDC out, Turkish lira into a
> bank account.

**GÖRÜNTÜ** — Leaderboard → `Close challenge` → `Rewards` altında dağılımı
gösterin → kazanan `Claim`. Sonra `Profile` → `Withdraw to IBAN` → tamamlanan
ekranda **"₺ sent"** satırı görünsün.

> Yarışma penceresi 26 Eylül'de kapanıyor. O tarihten önce çekim yapacaksanız
> kısa süreli (birkaç dakikalık) yeni bir yarışma açıp onu kapatın.

---

## Parça 8 — Neyin gerçek olduğu · 2:30 – 2:46 · **16 saniye**

**SES**

> One thing we do not hide. G-P-S cannot be verified trustlessly in a weekend,
> so distance is signed by our attestor key. That is the single centralised
> point in the system. It is documented in the README, and the roadmap
> decentralises it.

**GÖRÜNTÜ** — GitHub'da README'yi açın, `Deployed artifacts` tablosunu (kontrat
ID'leri ve WASM hash'leri) ve `Trust assumptions` başlığını gösterin.

> Bu parçayı atlamayın. Zayıflığı kendiniz söylemek, jürinin bulmasından çok
> daha iyidir ve teknik dürüstlük puan getirir.

---

## Parça 9 — Kapanış · 2:46 – 2:55 · **9 saniye**

**SES**

> RunForrest. Proof of active lifestyle. The prize pool is a contract, not a
> promise. Live now at runforrest dot vercel dot app.

**GÖRÜNTÜ** — `docs/brand/banner.png` tam ekran, ardından `runforrest.vercel.app`
adresi üç saniye ekranda kalsın.

---

## Çekim notları

- **Çözünürlük:** en az 1280×720. Telefon ekranlarını telefonu kameraya tutarak
  değil, **ekran kaydı** alarak çekin.
- **Freighter pencereleri kadrajda kalsın.** Kullanıcının imzaladığını göstermek
  ürünün non-custodial olduğunu kanıtlıyor.
- **Başta ve sonda iki saniye sessizlik** bırakın; montajda işinize yarar.
- Ekranda Türkçe bir şey görünmesin: tarayıcı dili, eklenti dili ve varsa banka
  sayfası. Arayüzün tamamı İngilizce, o halde kalsın.
- Her parçayı ayrı dosya olarak kaydedin: `01-problem.mp4`, `02-what.mp4` …
  Böylece bir parça kötü çıkarsa yalnızca onu tekrar çekersiniz.
