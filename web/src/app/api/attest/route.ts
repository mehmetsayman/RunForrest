/**
 * Run attestation — server side.
 *
 * WHY ON THE SERVER: `record_progress` and `record_run` require the attestor
 * key's signature. That key cannot live in the browser — if it did, anyone
 * could write any distance they liked to chain.
 *
 * TRUST ASSUMPTION, stated plainly: GPS data cannot be verified trustlessly
 * within a two-day hackathon window. This endpoint is the SOLE authority on
 * whether a run really happened, which makes the system centralised at this
 * point. We do not hide it: the README says so under "Trust assumptions", and
 * the roadmap covers how it gets decentralised (multiple attestors, device
 * signatures, ZK location proofs).
 *
 * The checks below do not establish honesty; they only filter out the crudest
 * nonsense.
 */

import { NextResponse } from "next/server";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export const runtime = "nodejs";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

const CHALLENGE_ID = process.env.NEXT_PUBLIC_RUNFORREST_CHALLENGE_ID ?? "";
const BADGE_ID = process.env.NEXT_PUBLIC_RUNFORREST_BADGE_ID ?? "";

/** Plausible run bounds — they filter out obvious nonsense. */
const MAX_DISTANCE_M = 100_000; // 100 km
const MIN_DISTANCE_M = 100;
const MIN_SPEED_MS = 0.5; // ~1.8 km/h — slower than walking
const MAX_SPEED_MS = 12; // ~43 km/h — above the world record

type Body = {
  runner: string;
  distanceM: number;
  durationS: number;
  city?: string;
  challengeId?: number;
};

async function invoke(
  signer: Keypair,
  contractId: string,
  method: string,
  args: Parameters<Contract["call"]>[1][],
): Promise<string> {
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(signer.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: NETWORK,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(signer);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`${method} reddedildi`);
  }

  const deadline = Date.now() + 45_000;
  for (;;) {
    const got = await server.getTransaction(sent.hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`${method} failed on chain`);
    }
    if (Date.now() > deadline) throw new Error(`${method} timed out`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export async function POST(req: Request) {
  const secret = process.env.ATTESTOR_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ATTESTOR_SECRET is not set on the server" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { runner, distanceM, durationS, city, challengeId } = body;

  /* ─── coarse sanity checks ─── */

  if (!runner || !/^G[A-Z2-7]{55}$/.test(runner)) {
    return NextResponse.json({ error: "Invalid runner address" }, { status: 400 });
  }
  if (
    !Number.isFinite(distanceM) ||
    distanceM < MIN_DISTANCE_M ||
    distanceM > MAX_DISTANCE_M
  ) {
    return NextResponse.json(
      { error: `Distance must be between ${MIN_DISTANCE_M}–${MAX_DISTANCE_M} m` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(durationS) || durationS <= 0) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const speed = distanceM / durationS;
  if (speed < MIN_SPEED_MS || speed > MAX_SPEED_MS) {
    return NextResponse.json(
      { error: `Non-human speed (${speed.toFixed(1)} m/s) — run rejected` },
      { status: 422 },
    );
  }

  /* ─── write to chain ─── */

  const attestor = Keypair.fromSecret(secret);
  const meters = Math.round(distanceM);
  const result: { progress?: string; badge?: string; errors: string[] } = {
    errors: [],
  };

  // Challenge progress — the contract rejects a runner who never joined, which is fine.
  if (challengeId !== undefined && CHALLENGE_ID) {
    try {
      result.progress = await invoke(attestor, CHALLENGE_ID, "record_progress", [
        nativeToScVal(challengeId, { type: "u32" }),
        new Address(runner).toScVal(),
        nativeToScVal(meters, { type: "u32" }),
      ]);
    } catch (e) {
      result.errors.push(`challenge: ${(e as Error).message}`);
    }
  }

  // City badge — independent of challenges, every run counts.
  if (city && BADGE_ID) {
    try {
      result.badge = await invoke(attestor, BADGE_ID, "record_run", [
        new Address(runner).toScVal(),
        nativeToScVal(city, { type: "string" }),
        nativeToScVal(meters, { type: "u32" }),
      ]);
    } catch (e) {
      result.errors.push(`badge: ${(e as Error).message}`);
    }
  }

  const anySuccess = !!result.progress || !!result.badge;
  return NextResponse.json(result, { status: anySuccess ? 200 : 502 });
}
