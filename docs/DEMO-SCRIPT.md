# Demo video script

Target length **2:20**. Written to be read by a synthetic voice, so the sentences
are short and the punctuation is doing real work — commas are breaths, full stops
are beats.

Two columns: what the viewer hears, and what they see while hearing it. The shot
column is the recording instruction, not narration — never read it aloud.

**Voice direction.** Calm and factual, not an advert. The product's whole claim is
that its numbers can be checked, and an over-excited read undermines that. Pace
around 150 words per minute; the script is written to that.

---

## 0:00 – 0:18 · The problem

> A runner in Istanbul wants to join a ten dollar distance challenge.
>
> Today that means finding an exchange, passing K-Y-C, buying crypto, and
> learning what a wallet is. Most people stop at step one.
>
> And the prize pool? It sits in the organiser's account. You cannot check it
> exists. You cannot check the payout rule. You just trust them.

**Shot.** Landing page, slow scroll from the hero to the four stat cards. Hold on
"100% POOL HELD ON CHAIN".

---

## 0:18 – 0:36 · What we built

> RunForrest makes the pool a contract instead of a promise, and the on-ramp a
> bank transfer instead of an exchange.
>
> Three Soroban contracts on Stellar Testnet. A Turkish lira rail in both
> directions. Twenty-four passing tests.

**Shot.** Cut to the leaderboard. The pool card fills the frame — ten USDC, one
runner, and the line reading "The pool is held in a DeFindex vault".

---

## 0:36 – 1:12 · The fiat rail

> Here is the part we care about most.
>
> A runner with no crypto taps Join. They are short on USDC, so the deposit sheet
> opens right there — no redirect, no pop-up, no leaving the app.
>
> The anchor speaks S-E-P six, which is programmatic, so we draw this screen
> ourselves. Behind it: discovery, authentication with the wallet key, K-Y-C, and
> a firm quote that locks the rate.
>
> The runner gets an I-B-A-N and a reference code. They send lira from their own
> bank. USDC lands in their wallet, and the join they started finishes by itself.

**Shot.** Tap "Join". Deposit sheet slides up. Type an amount. Show the IBAN and
reference code. Then the success state, then the leaderboard with the pool
increased.

---

## 1:12 – 1:32 · The run

> Now the running. GPS tracking with the accuracy circle drawn on the map — a
> poor reading still shows your position, but it does not count toward distance.
>
> Finish, confirm the city, save. The distance is signed and written on chain,
> and the city badge is minted.

**Shot.** `/run` with a live route drawn. Finish flow, city confirmation, then the
transaction hash appearing. Cut to `/mint` showing the badge.

---

## 1:32 – 1:54 · Payout and cash-out

> When the window closes, anyone can finalise. Not the organiser — anyone. The
> split is fixed in the contract: fifty, thirty, twenty.
>
> The winner claims, and the money leaves the way it came: USDC out, Turkish lira
> into a bank account.

**Shot.** Finalise, then the claim button, then Profile → "Withdraw to IBAN" and
the completed state showing lira sent.

---

## 1:54 – 2:12 · What is actually real

> Everything you just saw is on Stellar Testnet. The contract IDs and the WASM
> hashes are in the README.
>
> One thing we do not hide: GPS cannot be verified trustlessly in a weekend, so
> distance is signed by our attestor key. That is the single centralised point,
> it is documented, and the roadmap decentralises it.

**Shot.** Stellar Expert showing the challenge contract, then scroll the README's
deployed-artifacts table.

---

## 2:12 – 2:20 · Close

> RunForrest. The prize pool is a contract, not a promise.
>
> It is live at runforrest dot vercel dot app.

**Shot.** Banner, then the live URL held on screen for three seconds.

---

## Notes for recording

- Record at **1280×720** or higher. Phone-shaped screens are fine in a frame,
  but do not film an actual phone — screen-record it.
- The wallet steps need a real Freighter session; those shots cannot be
  automated and have to be captured on a machine with the extension.
- Keep the Freighter approval pop-ups in shot. They are proof the user signs,
  rather than the app holding a key.
- Leave two seconds of silence at the start and end for the edit.
