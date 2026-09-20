# Deploying to Vercel

The app lives in `web/`. Vercel's **root directory must point there** — that is
the one thing to get right.

---

## Path 1 — CLI (quick)

```bash
vercel login          # opens a browser, sign in
cd web
vercel --prod
```

The first run asks a few questions:

| Question | Answer |
|---|---|
| Set up and deploy? | **Y** |
| Which scope? | your own account |
| Link to existing project? | **N** |
| Project name? | `runforrest` |
| In which directory is your code located? | **`./`** (you are already in `web/`) |
| Auto-detected settings? | **Y** (Next.js) |

---

## Path 2 — GitHub integration (deploys on every push)

1. [vercel.com/new](https://vercel.com/new) → pick the repository
2. **Root Directory** → set it to `web` ← *skip this and the build fails*
3. Framework: Next.js (detected automatically)
4. Enter the environment variables below → Deploy

---

## Environment variables

### Required — the site loads without it, but runs are not written to chain

| Variable | Value |
|---|---|
| `ATTESTOR_SECRET` | The **testnet secret key** (`S…`) that signs run distances |

> **Server side.** Do **not** add the `NEXT_PUBLIC_` prefix. If it leaks into the
> browser, anyone can write any distance they like to chain.
>
> The contracts were deployed with this attestor address fixed in
> `__constructor`, and the config cannot be changed. Only the existing key works
> right now; if production needs a different one, `runforrest_challenge` has to
> be redeployed.

### Optional — run history and challenge metadata

| Variable | Note |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Leave it empty and route history stays off |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Exposed in the browser by design; protection lives in RLS |

For the tables: `web/scripts/setup.sql` → Supabase SQL Editor.
To check the status after deploying: `https://<domain>/api/setup-db`

### Defaulted — omit them and the values in the code are used

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_RUNFORREST_CHALLENGE_ID` | `CAN4QVZURUX6OLBFC7IH2HQHQDUJDD72UBGJLXR67BKACWBQF4JVUWCM` |
| `NEXT_PUBLIC_RUNFORREST_BADGE_ID` | `CBEMQGDLL2KNMBSINUSQM7QXMKAOMFIJDFQL27F3ZEWSRYA75WB3VCU6` |
| `NEXT_PUBLIC_RUNFORREST_VAULT_ID` | `CCHEMDA647SX2RPQ4FYQ3HLDXLVSREQSIAWXVQ2AYRMEHPQLVSGXASI7` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

---

## Post-deploy checklist

1. **Does the landing page load** — `/`
2. **Chain reads** — does `/leaderboard` show the challenge?
   (Soroban RPC is called directly from the browser; CORS is open)
3. **Anchor** — `/profile` → *Top up with TRY*; the anchor returns
   `access-control-allow-origin: *`, so no proxy is needed and calls go straight
   from the browser
4. **Attestation** — record a run; without `ATTESTOR_SECRET` it returns 503 with
   an explanatory message rather than crashing the page
5. **Supabase** — `/api/setup-db` → `"ready": true`
6. **Wallet** — Freighter must be on **Testnet**; for a new account the UI offers
   *activate account* → *enable USDC* as explicit steps

---

## Known limitations

**GPS requires HTTPS.** Vercel serves HTTPS, so this is fine — but
`navigator.geolocation` will not work on a copy served over `http://`.

**Map tiles come from OpenStreetMap.** Free, but not built for heavy use; move to
your own tile source once there is real traffic.

**The anchor is a sandbox.** The bank leg is simulated and KYC is auto-approved.
The Stellar leg is real testnet USDC.
