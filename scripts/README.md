# Verification scripts

These run against live testnet; the findings are recorded in
`docs/TECHNICAL-NOTES.md`.

```bash
cd scripts && npm i @stellar/stellar-sdk
node spike-sep10.mjs      # SEP-1 discovery -> SEP-10 JWT -> CORS -> authenticated call
node spike-onramp.mjs     # full deposit: trustline -> KYC -> quote -> deposit -> bank simulation
node spike-defindex.mjs   # DeFindex testnet contracts + asset mismatch check
```
