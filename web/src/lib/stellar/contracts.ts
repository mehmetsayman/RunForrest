/**
 * Soroban kontrat istemcisi — runforrest_challenge, runforrest_badge ve USDC.
 *
 * Reads are done by simulation (free, no signature). Writes are prepared,
 * signed in the wallet, submitted, and polled until they settle.
 *
 * Referans skill: skills/dapp/SKILL.md, skills/data/SKILL.md
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  RUNFORREST_BADGE_ID,
  RUNFORREST_CHALLENGE_ID,
  SOROBAN_RPC_URL,
  USDC_SAC,
} from "./config";
import { signTransaction } from "./wallet";

export const server = new rpc.Server(SOROBAN_RPC_URL);
export const horizon = new Horizon.Server(HORIZON_URL);

/** USDC has 7 decimals: 1 USDC = 10_000_000 stroops. */
export const STROOP = 10_000_000n;

export const toStroops = (usdc: string | number): bigint => {
  const [whole, frac = ""] = String(usdc).split(".");
  const padded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOP + BigInt(padded || "0");
};

export const fromStroops = (stroops: bigint | string | number): string => {
  const v = BigInt(stroops);
  const sign = v < 0n ? "-" : "";
  const abs = v < 0n ? -v : v;
  const whole = abs / STROOP;
  const frac = (abs % STROOP).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
};

export class ContractError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = "ContractError";
  }
}

/** Transaction result codes, in the words of someone who has to fix it. */
const SUBMIT_FAILURE: Record<string, string> = {
  txInsufficientBalance:
    "not enough XLM to cover the network fee — a contract call costs around 0.2 XLM",
  txInsufficientFee: "the offered fee was below the network minimum",
  txBadSeq: "sequence number out of date — reload the page and try again",
  txTooLate: "the transaction expired before it reached the network",
  txTooEarly: "the transaction was submitted before its valid-from time",
  txNoAccount: "the source account does not exist on chain yet",
  txBadAuth:
    "the signature did not check out — is the wallet on Testnet rather than Mainnet?",
  txMalformed: "the network considered the transaction malformed",
  txFailed: "an operation inside the transaction failed",
};

/**
 * The reason the network refused a transaction, as readable text.
 *
 * `sendTransaction` returning ERROR means the transaction was rejected before
 * it ever ran, and the reason is an XDR result code on the response.
 *
 * The accessor has moved between SDK versions: it used to be the method chain
 * `result().switch().name`, and in v17 it is the plain property `result.type`.
 * Reading it the old way throws, the catch swallows it, and the user is told
 * "the network gave no reason" — which is how this went unnoticed. Both shapes
 * are read now, and an unrecognised code is passed through verbatim rather than
 * hidden, since a raw code name is still something to search for.
 */
function submitFailureReason(errorResult: unknown): string {
  const r = (errorResult as { result?: unknown })?.result;
  let code: string | undefined;

  // v17 and later: a property holding the union arm name.
  code = (r as { type?: string })?.type;

  // Older SDKs: a method chain ending in an enum with a name.
  if (!code && typeof r === "function") {
    try {
      code = (
        errorResult as { result(): { switch(): { name: string } } }
      ).result().switch().name;
    } catch {
      /* not this shape either */
    }
  }

  if (!code) return "the network gave no reason";
  return SUBMIT_FAILURE[code] ?? code;
}

/* ────────────────────────────── core paths ─────────────────────────────── */

/**
 * Read-only call: simulated, nothing is written to chain, no signature asked.
 * The source account is irrelevant for a read — the simulation does not use it.
 */
async function read<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const contract = new Contract(contractId);
  // Any valid account is enough for a simulation.
  const dummy = new Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "0",
  );
  const tx = new TransactionBuilder(dummy, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractError(`${method} could not be read: ${sim.error}`, sim);
  }
  if (!sim.result?.retval) {
    throw new ContractError(`${method} returned an empty result`);
  }
  return scValToNative(sim.result.retval) as T;
}

/**
 * State-changing call: prepare → sign in the wallet → submit → await the result.
 */
async function write(
  contractId: string,
  method: string,
  source: string,
  args: xdr.ScVal[] = [],
): Promise<{ hash: string; returnValue: unknown }> {
  const contract = new Contract(contractId);
  const account = await server.getAccount(source);

  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  // prepareTransaction runs the simulation and fills in the footprint and auth tree.
  let prepared;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (e) {
    throw new ContractError(
      `${method} could not be prepared: ${(e as Error).message}`,
      e,
    );
  }

  const signedXdr = await signTransaction(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new ContractError(
      `${method} was rejected by the network: ${submitFailureReason(sent.errorResult)}`,
      sent.errorResult,
    );
  }
  // TRY_AGAIN_LATER means the RPC has not caught up and never will for this
  // hash. Left to fall through, it waits out the full polling deadline and
  // reports a timeout, which points the user at the wrong problem.
  if (sent.status === "TRY_AGAIN_LATER") {
    throw new ContractError(
      `${method} could not be submitted: the network is busy, try again in a moment`,
      sent,
    );
  }

  // Wait until it settles.
  const deadline = Date.now() + 60_000;
  for (;;) {
    const got = await server.getTransaction(sent.hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        hash: sent.hash,
        returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
      };
    }
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new ContractError(`${method} failed on chain`, got);
    }
    if (Date.now() > deadline) {
      throw new ContractError(`${method} timed out (hash ${sent.hash})`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

const addr = (a: string) => new Address(a).toScVal();
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const str = (s: string) => nativeToScVal(s, { type: "string" });

/**
 * Soroban's unit enum variants are decoded by `scValToNative` as a
 * SINGLE-ELEMENT ARRAY: `Status::Finalized` → `["Finalized"]`.
 *
 * Compare it directly (`status === "Finalized"`) and it is always false,
 * with no error — it simply misbehaves in silence. Caught while testing
 * against the live chain; we normalise it here in the read layer so the UI
 * only ever sees a plain string.
 */
function unwrapEnum<T extends string>(v: unknown): T {
  if (Array.isArray(v)) return String(v[0]) as T;
  return String(v) as T;
}

/* ──────────────────────────────── tipler ───────────────────────────────── */

export type ChallengeStatus = "Open" | "Finalized";

export type Challenge = {
  creator: string;
  entry_fee: bigint;
  start_time: bigint;
  end_time: bigint;
  target_distance_m: number;
  pool: bigint;
  shares: bigint;
  payout_pool: bigint;
  participants: number;
  status: ChallengeStatus;
};

export type Participant = {
  distance_m: number;
  runs: number;
  joined_at: bigint;
  payout: bigint;
  claimed: boolean;
};

export type BadgeTier = "Common" | "Rare" | "Epic" | "Legendary";

export type Badge = {
  city: string;
  runs: number;
  total_distance_m: bigint;
  tier: BadgeTier;
  first_earned: bigint;
  last_run: bigint;
};

/* ─────────────────────────── runforrest_challenge ───────────────────────────── */

export const challenges = {
  count: () => read<number>(RUNFORREST_CHALLENGE_ID, "challenge_count"),

  get: async (id: number): Promise<Challenge> => {
    const c = await read<Challenge>(RUNFORREST_CHALLENGE_ID, "get_challenge", [u32(id)]);
    return { ...c, status: unwrapEnum<ChallengeStatus>(c.status) };
  },

  roster: (id: number) =>
    read<string[]>(RUNFORREST_CHALLENGE_ID, "get_roster", [u32(id)]),

  /** Errors when the participant does not exist; the caller turns that into null. */
  participant: async (id: number, runner: string): Promise<Participant | null> => {
    try {
      return await read<Participant>(RUNFORREST_CHALLENGE_ID, "get_participant", [
        u32(id),
        addr(runner),
      ]);
    } catch {
      return null;
    }
  },

  /** Takes the entry fee in USDC and deposits it into the DeFindex vault. */
  join: (id: number, runner: string) =>
    write(RUNFORREST_CHALLENGE_ID, "join", runner, [u32(id), addr(runner)]),

  claim: (id: number, runner: string) =>
    write(RUNFORREST_CHALLENGE_ID, "claim", runner, [u32(id), addr(runner)]),

  /** Callable by anyone once the window has closed. */
  finalize: (id: number, caller: string) =>
    write(RUNFORREST_CHALLENGE_ID, "finalize", caller, [u32(id)]),

  create: (
    creator: string,
    opts: {
      entryFeeUsdc: string;
      startTime: number;
      endTime: number;
      targetDistanceM: number;
    },
  ) =>
    write(RUNFORREST_CHALLENGE_ID, "create_challenge", creator, [
      addr(creator),
      i128(toStroops(opts.entryFeeUsdc)),
      nativeToScVal(BigInt(opts.startTime), { type: "u64" }),
      nativeToScVal(BigInt(opts.endTime), { type: "u64" }),
      u32(opts.targetDistanceM),
    ]),

  /** Fetches every challenge along with its participant data. */
  listAll: async (viewer?: string) => {
    const n = await challenges.count();
    const out: Array<{ id: number; challenge: Challenge; mine: Participant | null }> =
      [];
    for (let id = 0; id < n; id++) {
      try {
        const challenge = await challenges.get(id);
        const mine = viewer ? await challenges.participant(id, viewer) : null;
        out.push({ id, challenge, mine });
      } catch {
        /* deleted or TTL-expired entry: skip */
      }
    }
    return out;
  },
};

/* ───────────────────────────── runforrest_badge ─────────────────────────────── */

export const badges = {
  cities: (runner: string) =>
    read<string[]>(RUNFORREST_BADGE_ID, "get_cities", [addr(runner)]),

  collection: async (runner: string): Promise<Badge[]> => {
    const list = await read<Badge[]>(RUNFORREST_BADGE_ID, "get_collection", [
      addr(runner),
    ]);
    return list.map((b) => ({ ...b, tier: unwrapEnum<BadgeTier>(b.tier) }));
  },

  get: async (runner: string, city: string): Promise<Badge | null> => {
    try {
      const b = await read<Badge>(RUNFORREST_BADGE_ID, "get_badge", [
        addr(runner),
        str(city),
      ]);
      return { ...b, tier: unwrapEnum<BadgeTier>(b.tier) };
    } catch {
      return null;
    }
  },
};

/* ──────────────────────────────── USDC ─────────────────────────────────── */

/**
 * Does the account exist on chain?
 *
 * On Stellar an account DOES NOT EXIST until it holds the minimum XLM
 * reserve. Connect a freshly created wallet and Horizon returns 404. Trying
 * to create a trustline without this check fails with a baffling "Not Found".
 */
export async function accountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) return false;
    // Network error: do not claim it does not exist.
    throw new ContractError(
      `Could not read account status: ${(e as Error).message}`,
      e,
    );
  }
}

/**
 * The XLM an account can actually spend on fees.
 *
 * Not the same as its balance. Stellar locks a minimum reserve away —
 * `(2 + subentries + sponsoring - sponsored) × 0.5 XLM` — and a wallet with a
 * USDC trustline has one subentry, so 1.5 XLM of whatever it holds is untouchable.
 * Offers reserve more on top through selling liabilities.
 *
 * Reading the raw balance instead is the mistake that made the first version of
 * this check useless: an account holding 1.6 XLM looks funded and has 0.1 to
 * spend, so the guard passes and the network still refuses the transaction.
 *
 * Returns 0 for an account that does not exist yet.
 */
export async function spendableXlm(address: string): Promise<number> {
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    if (!native) return 0;

    const subentries =
      account.subentry_count + account.num_sponsoring - account.num_sponsored;
    const reserve = (2 + subentries) * 0.5;
    const locked = reserve + Number(native.selling_liabilities ?? 0);

    return Math.max(0, Number(native.balance) - locked);
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) return 0;
    throw new ContractError(
      `Could not read XLM balance: ${(e as Error).message}`,
      e,
    );
  }
}

/**
 * Spendable XLM a contract call needs to be worth attempting.
 *
 * `join` measures at about 0.21 XLM on testnet. The margin leaves room for the
 * fee to move with network load and for a claim afterwards.
 */
export const MIN_XLM_FOR_FEES = 0.5;

/**
 * Funds a testnet account via Friendbot.
 *
 * This both activates a new account and tops up an existing one — Friendbot
 * answers 200 and sends 10,000 XLM either way.
 *
 * Testnet only. On mainnet another account funds it; in a real product this
 * step is replaced by sponsored account creation, so the user never has to
 * see XLM at all.
 */
export async function fundTestnetAccount(address: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`,
  );
  if (!res.ok && res.status !== 400) {
    throw new ContractError(`Friendbot could not fund the account (${res.status})`);
  }
  // A 400 usually means "already exists" — not a problem.
}

/** The wallet's USDC balance, in stroops. Zero without a trustline. */
export async function usdcBalance(address: string): Promise<bigint> {
  try {
    const v = await read<bigint>(USDC_SAC, "balance", [addr(address)]);
    return BigInt(v);
  } catch {
    return 0n;
  }
}

/**
 * Does the account have a USDC trustline?
 *
 * The anchor can only send USDC directly when a trustline exists; without one
 * the deposit waits in `pending_trust`. We check before starting the ramp.
 */
export async function hasUsdcTrustline(address: string): Promise<boolean> {
  const { USDC_CODE, USDC_ISSUER } = await import("./config");
  try {
    const account = await horizon.loadAccount(address);
    return account.balances.some(
      (b) =>
        "asset_code" in b &&
        b.asset_code === USDC_CODE &&
        b.asset_issuer === USDC_ISSUER,
    );
  } catch {
    return false;
  }
}

/** Creates the USDC trustline. The user does this once. */
export async function createUsdcTrustline(address: string): Promise<string> {
  const { Asset, Operation } = await import("@stellar/stellar-sdk");
  const { USDC_CODE, USDC_ISSUER } = await import("./config");

  if (!(await accountExists(address))) {
    throw new ContractError(
      "Your Stellar account is not activated yet. Activate it first.",
    );
  }

  const account = await horizon.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 10),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({ asset: new Asset(USDC_CODE, USDC_ISSUER) }),
    )
    .setTimeout(120)
    .build();

  const signedXdr = await signTransaction(tx.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const res = await horizon.submitTransaction(
    signed as Parameters<typeof horizon.submitTransaction>[0],
  );
  return res.hash;
}
