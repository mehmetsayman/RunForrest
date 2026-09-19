/**
 * TR Mock Anchor istemcisi — SEP-1 / SEP-10 / SEP-12 / SEP-38 / SEP-6.
 *
 * Bu anchor SEP-24 (anchor-barındırmalı popup) KONUŞMAZ; SEP-6 (programatik) konuşur.
 * Bu yüzden ramp arayüzünü RunForrest'ın kendi içinde çiziyoruz — iframe yok, akış kesintisiz.
 *
 * Anchor CORS'u `*` olarak açıyor, dolayısıyla tüm çağrılar doğrudan tarayıcıdan
 * yapılabiliyor; sunucu tarafı proxy'ye gerek yok. (Canlı doğrulandı.)
 *
 * Referans skill: CheesecakeLabs/stellar-anchor-skill/SKILL.md
 *                 skills/standards/SKILL.md (SEP seçimi)
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
      `Anchor JSON olmayan yanıt döndü: ${text.slice(0, 120)}`,
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
 * stellar.toml'u okuyup endpoint'leri çıkarır.
 *
 * Entegrasyonun tamamı iki değere dayanıyor: home domain + varlık kodu.
 * Geri kalan her şey burada keşfediliyor — mainnet'e geçerken sadece
 * home domain değişiyor, kod aynı kalıyor.
 */
export async function discover(): Promise<AnchorInfo> {
  if (infoCache) return infoCache;

  const res = await fetch(`${base}/.well-known/stellar.toml`);
  if (!res.ok) {
    throw new AnchorError("stellar.toml okunamadı", res.status, "/.well-known");
  }
  const toml = await res.text();
  const key = (k: string) => toml.match(new RegExp(`^${k}="(.*)"`, "m"))?.[1];

  // [[CURRENCIES]] bloğundan USDC'yi bul
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
    throw new AnchorError("stellar.toml içinde USDC issuer bulunamadı");
  }
  infoCache = info;
  return info;
}

/* ──────────────────────────── SEP-10: auth ────────────────────────────── */

/**
 * Kullanıcının Stellar anahtarıyla kimlik doğrular ve JWT döndürür.
 *
 * Non-custodial: anahtar kullanıcının kendisinde. Anchor bir challenge işlemi
 * gönderir, kullanıcı imzalar, anchor imzayı doğrulayıp token verir.
 * Parola yok, API anahtarı yok — kimlik, anahtarın kendisi.
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
    throw new AnchorError("Anchor challenge işlemi döndürmedi");
  }

  // Challenge'ı anchor'ın kendi imza anahtarının ürettiğini doğrula.
  // Bu kontrol olmadan sahte bir anchor bize imzalatabilir.
  const { Transaction } = await import("@stellar/stellar-sdk");
  const tx = new Transaction(challenge.transaction, challenge.network_passphrase);
  if (signingKey && tx.source !== signingKey) {
    throw new AnchorError(
      `Challenge kaynağı beklenen imza anahtarı değil (${tx.source})`,
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

  if (!token) throw new AnchorError("Anchor JWT döndürmedi");
  return token;
}

const auth = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

/* ───────────────────────────── SEP-12: KYC ────────────────────────────── */

/**
 * KYC kaydı. Bu sandbox'ta otomatik onaylanır ve kişisel veri istemez.
 * Gerçek bir anchor'da burada belge/bilgi alanları döner — akış aynı kalır.
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

/** Gösterim amaçlı canlı kur (bağlayıcı değil). Reflector oracle + spread. */
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
 * Kuru KİLİTLER. Dönen quote.id, SEP-6 deposit/withdraw çağrısına geçirilir;
 * böylece kullanıcı havaleyi yaparken kur oynamaz.
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
 * ON-RAMP başlatır: TRY → USDC.
 *
 * Dönen `instructions` kullanıcının göreceği iki şeyi taşır:
 *   - bank_account_number  → havale yapılacak IBAN
 *   - external_transfer_memo → havale AÇIKLAMASINA yazılacak referans kodu
 *
 * NOT: `destination_asset` sadece varlık KODU ("USDC") olmalı.
 * `stellar:USDC:G...` formatı bu anchor tarafından reddediliyor (canlı doğrulandı).
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
 * OFF-RAMP başlatır: USDC → TRY.
 *
 * Dönen `account_id` + `memo` ile kullanıcı USDC'yi zincirde gönderir;
 * anchor ödemeyi memo'dan eşleştirip TRY'yi IBAN'a öder.
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
 * İşlem bitene kadar durumu yoklar.
 * @param onUpdate her durum değişiminde çağrılır — UI'ı canlı tutmak için.
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
    if (opts.signal?.aborted) throw new AnchorError("Takip iptal edildi");

    const tx = await getTransaction(jwt, id);
    if (tx.status !== last) {
      last = tx.status;
      onUpdate(tx);
    }
    if (tx.status === "completed" || tx.status === "error") return tx;
    if (Date.now() > deadline) {
      throw new AnchorError(`İşlem zaman aşımına uğradı (son durum: ${tx.status})`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * SANDBOX: bankayı oynatır — TRY'nin geldiğini anchor'a bildirir.
 *
 * Gerçek bir anchor'da bu adım yok; parayı kullanıcının bankası gönderir.
 * Demoda judge'ın havale beklemesini engellemek için var.
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
