# RunForrest — marka ve tasarım sistemi

## Renkler kaynaktan alındı, uydurulmadı

Palet `@stellar/design-system@4.0.2` paketinin `sds-theme-dark` bloğundan
çıkarıldı. Tahmin ya da "Stellar sarısına benzer bir şey" değil — birebir
token değerleri.

| Rol | Token | Değer |
|---|---|---|
| **Marka / primary** | `gold-09` | `#fdda24` |
| Primary açık | `gold-10` | `#ffef5c` |
| Primary koyu | `gold-11` | `#f0c000` |
| İkincil vurgu | `lilac-11` | `#9e8cfc` |
| Üçüncül vurgu | `teal-11` | `#00c2d7` |
| Uyarı | `amber-09` | `#ffb224` |
| Başarı | `green-11` | `#4cc38a` |
| Hata | `red-11` | `#ff6369` |
| Zemin | `base-00` | `#000000` |
| Yüzey | `gray-01` | `#161616` |
| Kenarlık | `gray-06` | `#343434` |
| Metin | `gray-12` | `#ededed` |
| Soluk metin | `gray-11` | `#a0a0a0` |

> **Altın üstünde metin daima koyu** (`#161616`). Beyaz metin altın zeminde
> kontrast eşiğini geçmez. `--primary-foreground` bu yüzden `#161616`.

## Tipografi

Stellar Design System tek aile kullanıyor; ayrımı ağırlık ve harf aralığıyla
yapıyor, ikinci bir aileyle değil.

- **Inter** — metin ve başlıklar (`latin-ext` alt kümesiyle: ş ğ ı İ ç ö ü)
- **Inconsolata** — monospace: adresler, işlem hash'leri, teknik etiketler

## Token adı yetmez, değer de değişmeli

Bir tasarım sistemini benimsemek CSS değişken **adlarını** değiştirmek değildir.
`--brand-light` gibi bir isim doğru görünürken altındaki değer başka bir
palete ait olabilir; kod okunduğunda tutarlı, ekranda değil. Bu yüzden palet
`theme.scss`'ten çıkarıldı ve her değer tek tek karşılığıyla eşleştirildi.

Aynı sebeple `text-white` gibi kalıplara dikkat etmek gerekti: altın zeminde
beyaz metin kontrast eşiğini geçmiyor. Renk değişimi mekanik yapılırsa bu tür
erişilebilirlik hataları sessizce içeri sızar.

## Banner

`banner.png` — 1280×640 (GitHub sosyal önizleme standardı), 2× yoğunlukta
render edilir.

Yeniden üretmek için:

```bash
cd docs/brand
npm i playwright && npx playwright install chromium
node render.mjs          # banner.html -> banner.png
```

Tasarım kuralları (banner-design skill):
- Kritik içerik merkezi %75'lik güvenli alanda
- En fazla iki yazı tipi (Inter + Inconsolata)
- Başlık ≥ 32px, gövde ≥ 16px
- Metin/zemin kontrastı ≥ 4.5:1
- Tek odak noktası

Sağdaki çizgi dekoratif değil: teal bir başlangıç noktasından altın bir varışa
giden koşu rotası — ürünün ne yaptığını tek görselde anlatıyor.
