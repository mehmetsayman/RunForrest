/**
 * TR Mock Anchor istemcisi — SEP-1 / SEP-10 / SEP-12 / SEP-38 / SEP-6.
 *
 * This anchor does NOT speak SEP-24 (anchor-hosted popup); it speaks SEP-6 (programmatic).
 * So the ramp UI is drawn inside RunForrest itself — no iframe, no broken flow.
 *
 * The anchor sets CORS to `*`, so every call can be made straight from the
 * browser; no server-side proxy is needed. (Verified live.)
 *
 * Referans skill: CheesecakeLabs/stellar-anchor-skill/SKILL.md
 *                 skills/standards/SKILL.md (choosing the SEPs)
 */

import { ANCHOR_HOME_DOMAIN } from "@/lib/stellar/config";
import {
  AnchorError,
  type AnchorInfo,
  type CustomerResponse,
  type DepositResponse,
  type Quote,
  type Sep6Transaction,
  type SignXdr,
  type WithdrawResponse,
} from "./types";

const base = `https://${ANCHOR_HOME_DOMAIN}`;

async function parse<T>(res: Response, endpoint: string): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AnchorError(
      `The anchor returned a non-JSON response: ${text.slice(0, 120)}`,
      res.status,
      endpoint,
    );
  }
  if (!res.ok) {
    const b = body as { error?: unknown };
    const msg =
      typeof b?.error === "string"
        ? b.error
        : typeof (b?.error as { message?: string })?.message === "string"
          ? (b.error as { message: string }).message
          : `HTTP ${res.status}`;
    throw new AnchorError(msg, res.status, endpoint);
  }
  return body as T;
}

/* ─────────────────────────── SEP-1: discovery ─────────────────────────── */

let infoCache: AnchorInfo | null = null;

/**
 * Reads stellar.toml and extracts the endpoints.
 *
 * The whole integration rests on two values: the home domain and the asset code.
 * Everything else is discovered here, so moving to mainnet changes only the
 * home domain — the code stays as it is.
 */
export async function discover(): Promise<AnchorInfo> {
  if (infoCache) return infoCache;

  const res = await fetch(`${base}/.well-known/stellar.toml`);
  if (!res.ok) {
    throw new AnchorError("Could not read stellar.toml", res.status, "/.well-known");
  }
  const toml = await res.text();
  const key = (k: string) => toml.match(new RegExp(`^${k}="(.*)"`, "m"))?.[1];

  // Find USDC in the [[CURRENCIES]] block
  const currency = toml.match(/code="(\w+)"\s*\n\s*issuer="(G[A-Z0-9]+)"/);

  const info: AnchorInfo = {
    webAuthEndpoint: key("WEB_AUTH_ENDPOINT") ?? `${base}/auth`,
    transferServer: key("TRANSFER_SERVER") ?? `${base}/sep6`,
    kycServer: key("KYC_SERVER") ?? `${base}/sep12`,
    quoteServer: key("ANCHOR_QUOTE_SERVER") ?? `${base}/sep38`,
    signingKey: key("SIGNING_KEY") ?? "",
    assetCode: currency?.[1] ?? "USDC",
    assetIssuer: currency?.[2] ?? "",
  };

  if (!info.assetIssuer) {
    throw new AnchorError("No USDC issuer found in stellar.toml");
  }
  infoCache = info;
  return info;
}

/* ──────────────────────────── SEP-10: auth ────────────────────────────── */

/**
 * Authenticates with the user's Stellar key and returns a JWT.
 *
 * Non-custodial: the key stays with the user. The anchor sends a challenge
 * transaction, the user signs it, and the anchor verifies it and issues a token.
 * No password, no API key — the key itself is the identity.
 */
export async function authenticate(
  account: string,
  signXdr: SignXdr,
): Promise<string> {
  const { webAuthEndpoint, signingKey } = await discover();

  const challenge = await parse<{
    transaction: string;
    network_passphrase: string;
  }>(
    await fetch(`${webAuthEndpoint}?account=${encodeURIComponent(account)}`),
    "SEP-10 challenge",
  );

  if (!challenge.transaction) {
    throw new AnchorError("The anchor returned no challenge transaction");
  }

  // Verify the challenge was produced by the anchor's own signing key.
  // Without this check, a fake anchor could get us to sign for it.
  const { Transaction } = await import("@stellar/stellar-sdk");
  const tx = new Transaction(challenge.transaction, challenge.network_passphrase);
  if (signingKey && tx.source !== signingKey) {
    throw new AnchorError(
      `Challenge source is not the expected signing key (${tx.source})`,
    );
  }

  const signed = await signXdr(challenge.transaction);

  const { token } = await parse<{ token: string }>(
    await fetch(webAuthEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: signed }),
    }),
    "SEP-10 token",
  );

  if (!token) throw new AnchorError("The anchor returned no JWT");
  return token;
}

const auth = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

/* ───────────────────────────── SEP-12: KYC ────────────────────────────── */

/**
 * KYC registration. In this sandbox it is auto-approved and asks for no personal data.
 * A real anchor would return document and information fields here; the flow is the same.
 */
export async function ensureCustomer(
  jwt: string,
  account: string,
  type: "sep6-deposit" | "sep6-withdraw" = "sep6-deposit",
): Promise<CustomerResponse> {
  const { kycServer } = await discover();

  await fetch(`${kycServer}/customer`, {
    method: "PUT",
    headers: { ...auth(jwt), "Content-Type": "application/json" },
    body: JSON.stringify({ account, type }),
  });

  return parse<CustomerResponse>(
    await fetch(
      `${kycServer}/customer?account=${encodeURIComponent(account)}`,
      { headers: auth(jwt) },
    ),
    "SEP-12 customer",
  );
}

/* ──────────────────────────── SEP-38: kurlar ──────────────────────────── */

/** Indicative live rate (non-binding). Reflector oracle + spread. */
export async function indicativePrice(
  jwt: string,
  sellTry: string,
): Promise<{ buyAmount: string; rate: string; fee: string }> {
  const { quoteServer, assetCode, assetIssuer } = await discover();
  const p = new URLSearchParams({
    sell_asset: "iso4217:TRY",
    buy_asset: `stellar:${assetCode}:${assetIssuer}`,
    sell_amount: sellTry,
    context: "sep6",
  });
  const q = await parse<Quote>(
    await fetch(`${quoteServer}/price?${p}`, { headers: auth(jwt) }),
    "SEP-38 price",
  );
  return { buyAmount: q.buy_amount, rate: q.total_price, fee: q.fee.total };
}

/**
 * LOCKS the rate. The returned quote.id is passed to the SEP-6 deposit/withdraw
 * call, so the rate cannot move while the user makes the transfer.
 */
export async function lockQuote(
  jwt: string,
  opts:
    | { direction: "onramp"; sellTry: string }
    | { direction: "offramp"; sellUsdc: string },
): Promise<Quote> {
  const { quoteServer, assetCode, assetIssuer } = await discover();
  const stellarAsset = `stellar:${assetCode}:${assetIssuer}`;

  const body =
    opts.direction === "onramp"
      ? {
          sell_asset: "iso4217:TRY",
          buy_asset: stellarAsset,
          sell_amount: opts.sellTry,
          context: "sep6",
          sell_delivery_method: "bank_account",
        }
      : {
          sell_asset: stellarAsset,
          buy_asset: "iso4217:TRY",
          sell_amount: opts.sellUsdc,
          context: "sep6",
          buy_delivery_method: "bank_account",
        };

  return parse<Quote>(
    await fetch(`${quoteServer}/quote`, {
      method: "POST",
      headers: { ...auth(jwt), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "SEP-38 quote",
  );
}

/* ─────────────────────────── SEP-6: transfer ──────────────────────────── */

/**
 * Starts a DEPOSIT: TRY → USDC.
 *
 * The returned `instructions` carry the two things the user needs to see:
 *   - bank_account_number   → the IBAN to transfer to
 *   - external_transfer_memo → the reference code for the transfer DESCRIPTION
 *
 * NOTE: `destination_asset` must be the asset CODE only ("USDC").
 * The `stellar:USDC:G...` form is rejected by this anchor (verified live).
 */
export async function startDeposit(
  jwt: string,
  opts: { account: string; amountTry: string; quoteId?: string },
): Promise<DepositResponse> {
  const { transferServer, assetCode } = await discover();

  const p = new URLSearchParams({
    destination_asset: assetCode,
    source_asset: "iso4217:TRY",
    amount: opts.amountTry,
    account: opts.account,
    type: "bank_account",
  });
  if (opts.quoteId) p.set("quote_id", opts.quoteId);

  return parse<DepositResponse>(
    await fetch(`${transferServer}/deposit-exchange?${p}`, {
      headers: auth(jwt),
    }),
    "SEP-6 deposit-exchange",
  );
}

/**
 * Starts a WITHDRAWAL: USDC → TRY.
 *
 * With the returned `account_id` + `memo` the user sends USDC on chain;
 * the anchor matches the payment by memo and pays out TRY to the IBAN.
 */
export async function startWithdraw(
  jwt: string,
  opts: { amountUsdc: string; quoteId?: string },
): Promise<WithdrawResponse> {
  const { transferServer, assetCode } = await discover();

  const p = new URLSearchParams({
    source_asset: assetCode,
    destination_asset: "iso4217:TRY",
    amount: opts.amountUsdc,
    type: "bank_account",
  });
  if (opts.quoteId) p.set("quote_id", opts.quoteId);

  return parse<WithdrawResponse>(
    await fetch(`${transferServer}/withdraw-exchange?${p}`, {
      headers: auth(jwt),
    }),
    "SEP-6 withdraw-exchange",
  );
}

export async function getTransaction(
  jwt: string,
  id: string,
): Promise<Sep6Transaction> {
  const { transferServer } = await discover();
  const r = await parse<{ transaction: Sep6Transaction }>(
    await fetch(`${transferServer}/transaction?id=${encodeURIComponent(id)}`, {
      headers: auth(jwt),
    }),
    "SEP-6 transaction",
  );
  return r.transaction;
}

/**
 * Polls the status until the transaction settles.
 * @param onUpdate called on every status change, to keep the UI live.
 */
export async function pollTransaction(
  jwt: string,
  id: string,
  onUpdate: (tx: Sep6Transaction) => void,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Sep6Transaction> {
  const interval = opts.intervalMs ?? 3000;
  const deadline = Date.now() + (opts.timeoutMs ?? 5 * 60_000);
  let last = "";

  for (;;) {
    if (opts.signal?.aborted) throw new AnchorError("Tracking cancelled");

    const tx = await getTransaction(jwt, id);
    if (tx.status !== last) {
      last = tx.status;
      onUpdate(tx);
    }
    if (tx.status === "completed" || tx.status === "error") return tx;
    if (Date.now() > deadline) {
      throw new AnchorError(`Transaction timed out (last status: ${tx.status})`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * SANDBOX: plays the bank — tells the anchor the TRY has arrived.
 *
 * A real anchor has no such step; the user's bank sends the money.
 * It exists so a reviewer does not have to wait on a bank transfer.
 */
export async function simulateBankTransfer(
  jwt: string,
  txId: string,
  amountTry?: string,
): Promise<void> {
  const res = await fetch(
    `${base}/sep6/tx/${encodeURIComponent(txId)}/simulate-bank-transfer`,
    {
      method: "POST",
      headers: { ...auth(jwt), "Content-Type": "application/json" },
      body: JSON.stringify(amountTry ? { amount: amountTry } : {}),
    },
  );
  if (!res.ok) {
    await parse(res, "simulate-bank-transfer");
  }
}
