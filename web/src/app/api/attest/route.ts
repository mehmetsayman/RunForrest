/**
 * Koşu onaylama (attestation) — sunucu tarafı.
 *
 * NEDEN SUNUCUDA: `record_progress` ve `record_run` attestor anahtarının
 * imzasını istiyor. O anahtar tarayıcıya konamaz; konsaydı herkes istediği
 * mesafeyi zincire yazabilirdi.
 *
 * GÜVEN VARSAYIMI — açıkça: GPS verisi iki günlük bir hackathon penceresinde
 * trustless doğrulanamaz. Bu uç nokta, koşunun gerçekten yapıldığına dair
 * TEK otorite. Yani sistem bu noktada merkezî. Gizlemiyoruz; README'de
 * "Güven varsayımları" başlığı altında yazılı ve yol haritasında bunun nasıl
 * dağıtılacağı (çoklu attestor, cihaz imzası, ZK konum kanıtı) anlatılıyor.
 *
 * Buradaki kontroller dürüstlük sağlamaz, yalnızca en kaba saçmalıkları eler.
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

/** Makul koşu sınırları — bariz uydurmaları eler. */
const MAX_DISTANCE_M = 100_000; // 100 km
const MIN_DISTANCE_M = 100;
const MIN_SPEED_MS = 0.5; // ~1.8 km/s — yürüyüşten yavaş
const MAX_SPEED_MS = 12; // ~43 km/s — dünya rekoru üstü

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
      throw new Error(`${method} zincirde başarısız oldu`);
    }
    if (Date.now() > deadline) throw new Error(`${method} zaman aşımı`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export async function POST(req: Request) {
  const secret = process.env.ATTESTOR_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Sunucuda ATTESTOR_SECRET tanımlı değil" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const { runner, distanceM, durationS, city, challengeId } = body;

  /* ─── kaba akıl kontrolleri ─── */

  if (!runner || !/^G[A-Z2-7]{55}$/.test(runner)) {
    return NextResponse.json({ error: "Geçersiz koşucu adresi" }, { status: 400 });
  }
  if (
    !Number.isFinite(distanceM) ||
    distanceM < MIN_DISTANCE_M ||
    distanceM > MAX_DISTANCE_M
  ) {
    return NextResponse.json(
      { error: `Mesafe ${MIN_DISTANCE_M}–${MAX_DISTANCE_M} m aralığında olmalı` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(durationS) || durationS <= 0) {
    return NextResponse.json({ error: "Geçersiz süre" }, { status: 400 });
  }

  const speed = distanceM / durationS;
  if (speed < MIN_SPEED_MS || speed > MAX_SPEED_MS) {
    return NextResponse.json(
      { error: `İnsan dışı hız (${speed.toFixed(1)} m/s) — koşu reddedildi` },
      { status: 422 },
    );
  }

  /* ─── zincire yaz ─── */

  const attestor = Keypair.fromSecret(secret);
  const meters = Math.round(distanceM);
  const result: { progress?: string; badge?: string; errors: string[] } = {
    errors: [],
  };

  // Yarışma ilerlemesi — koşucu katılmadıysa kontrat reddeder, bu normaldir.
  if (challengeId !== undefined && CHALLENGE_ID) {
    try {
      result.progress = await invoke(attestor, CHALLENGE_ID, "record_progress", [
        nativeToScVal(challengeId, { type: "u32" }),
        new Address(runner).toScVal(),
        nativeToScVal(meters, { type: "u32" }),
      ]);
    } catch (e) {
      result.errors.push(`yarışma: ${(e as Error).message}`);
    }
  }

  // Şehir rozeti — yarışmadan bağımsız, her koşu sayılır.
  if (city && BADGE_ID) {
    try {
      result.badge = await invoke(attestor, BADGE_ID, "record_run", [
        new Address(runner).toScVal(),
        nativeToScVal(city, { type: "string" }),
        nativeToScVal(meters, { type: "u32" }),
      ]);
    } catch (e) {
      result.errors.push(`rozet: ${(e as Error).message}`);
    }
  }

  const anySuccess = !!result.progress || !!result.badge;
  return NextResponse.json(result, { status: anySuccess ? 200 : 502 });
}
