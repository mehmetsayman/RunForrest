/**
 * Soroban kontrat istemcisi — runforrest_challenge, runforrest_badge ve USDC.
 *
 * Okumalar simülasyonla yapılır (ücretsiz, imza gerektirmez). Yazmalar
 * hazırlanır, cüzdanda imzalanır, gönderilir ve sonuçlanana kadar yoklanır.
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

/** USDC 7 ondalıklı: 1 USDC = 10_000_000 stroop. */
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

/* ────────────────────────────── temel yollar ───────────────────────────── */

/**
 * Salt-okunur çağrı: simüle edilir, zincire hiçbir şey yazılmaz, imza istenmez.
 * Okuma için kaynak hesap önemsiz — simülasyon onu kullanmıyor.
 */
async function read<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const contract = new Contract(contractId);
  // Simülasyon için herhangi bir geçerli hesap yeterli.
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
    throw new ContractError(`${method} okunamadı: ${sim.error}`, sim);
  }
  if (!sim.result?.retval) {
    throw new ContractError(`${method} boş sonuç döndürdü`);
  }
  return scValToNative(sim.result.retval) as T;
}

/**
 * Durum değiştiren çağrı: hazırla → cüzdanda imzala → gönder → sonucu bekle.
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

  // prepareTransaction simülasyonu çalıştırır, footprint ve auth ağacını doldurur.
  let prepared;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (e) {
    throw new ContractError(
      `${method} hazırlanamadı: ${(e as Error).message}`,
      e,
    );
  }

  const signedXdr = await signTransaction(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new ContractError(`${method} reddedildi`, sent.errorResult);
  }

  // Sonuçlanana kadar bekle.
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
      throw new ContractError(`${method} zincirde başarısız oldu`, got);
    }
    if (Date.now() > deadline) {
      throw new ContractError(`${method} zaman aşımına uğradı (hash ${sent.hash})`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

const addr = (a: string) => new Address(a).toScVal();
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const str = (s: string) => nativeToScVal(s, { type: "string" });

/**
 * Soroban'ın birim (unit) enum varyantları `scValToNative` tarafından
 * TEK ELEMANLI DİZİ olarak çözülür: `Status::Finalized` → `["Finalized"]`.
 *
 * Doğrudan karşılaştırırsanız (`status === "Finalized"`) her zaman false
 * döner ve hata vermez — sessizce yanlış davranır. Canlı zincire karşı
 * test edilirken yakalandı; okuma katmanında burada normalize ediyoruz ki
 * arayüz düz string görsün.
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

  /** Katılımcı yoksa hata döner; çağıran tarafta null'a çeviriyoruz. */
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

  /** Katılım ücretini USDC olarak alır ve DeFindex vault'una yatırır. */
  join: (id: number, runner: string) =>
    write(RUNFORREST_CHALLENGE_ID, "join", runner, [u32(id), addr(runner)]),

  claim: (id: number, runner: string) =>
    write(RUNFORREST_CHALLENGE_ID, "claim", runner, [u32(id), addr(runner)]),

  /** Bitiş zamanı geçtiyse herkes çağırabilir. */
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

  /** Tüm yarışmaları katılımcı bilgisiyle birlikte getirir. */
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
        /* silinmiş ya da TTL'i dolmuş kayıt: atla */
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
 * Hesap zincirde var mı?
 *
 * Stellar'da bir hesap, minimum XLM rezervini alana kadar VAR OLMAZ. Yeni
 * kurulmuş bir cüzdan bağlandığında Horizon 404 döner. Bunu kontrol etmeden
 * trustline açmaya çalışmak anlamsız bir "Not Found" hatasıyla sonuçlanır.
 */
export async function accountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) return false;
    // Ağ hatası: var olmadığını iddia etme.
    throw new ContractError(
      `Hesap durumu okunamadı: ${(e as Error).message}`,
      e,
    );
  }
}

/**
 * Testnet hesabını Friendbot ile açar.
 *
 * Yalnızca testnet'te mümkün. Mainnet'te hesabı başka bir hesap fonlar; bu
 * adımın yerini gerçek üründe sponsored account creation alır (kullanıcı
 * hiç XLM görmeden hesabı açılır).
 */
export async function fundTestnetAccount(address: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`,
  );
  if (!res.ok && res.status !== 400) {
    throw new ContractError(`Hesap açılamadı (Friendbot ${res.status})`);
  }
  // 400 genelde "zaten var" demek — sorun değil.
}

/** Cüzdanın USDC bakiyesi (stroop). Trustline yoksa 0. */
export async function usdcBalance(address: string): Promise<bigint> {
  try {
    const v = await read<bigint>(USDC_SAC, "balance", [addr(address)]);
    return BigInt(v);
  } catch {
    return 0n;
  }
}

/**
 * Hesabın USDC trustline'ı var mı?
 *
 * Anchor USDC'yi ancak trustline varsa doğrudan gönderebilir; yoksa deposit
 * `pending_trust` durumunda bekler. Ramp'ı başlatmadan önce kontrol ediyoruz.
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

/** USDC trustline açar. Kullanıcı bunu bir kez yapar. */
export async function createUsdcTrustline(address: string): Promise<string> {
  const { Asset, Operation } = await import("@stellar/stellar-sdk");
  const { USDC_CODE, USDC_ISSUER } = await import("./config");

  if (!(await accountExists(address))) {
    throw new ContractError(
      "Stellar hesabın henüz açılmamış. Önce hesabı etkinleştir.",
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
