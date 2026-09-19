# Doğrulama script'leri

Canlı testnet'e karşı çalışırlar; bulgular `docs/TEKNIK-NOTLAR.md`.

```bash
cd scripts && npm i @stellar/stellar-sdk
node spike-sep10.mjs      # SEP-1 discovery -> SEP-10 JWT -> CORS -> korumali cagri
node spike-onramp.mjs     # tam on-ramp: trustline -> KYC -> quote -> deposit -> banka simulasyonu
node spike-defindex.mjs   # DeFindex testnet kontratlari + varlik uyusmazligi kontrolu
```
