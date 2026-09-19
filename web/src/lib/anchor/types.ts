/**
 * TR Mock Anchor — SEP tipleri.
 *
 * Bu tipler canlı anchor'dan dönen gerçek yanıtlara göre yazıldı
 * (bkz. docs/TEKNIK-NOTLAR.md). Spec'ten kopya değil.
 */

/** SEP-1: stellar.toml'dan keşfedilen endpoint'ler. */
export type AnchorInfo = {
  webAuthEndpoint: string;
  transferServer: string;
  kycServer: string;
  quoteServer: string;
  signingKey: string;
  assetCode: string;
  assetIssuer: string;
};

/** SEP-10: challenge yanıtı. */
export type Sep10Challenge = {
  transaction: string;
  network_passphrase: string;
};

/** SEP-12: KYC durumu. Bu anchor'da otomatik onaylanır. */
export type KycStatus = "ACCEPTED" | "PROCESSING" | "NEEDS_INFO" | "REJECTED";

export type CustomerResponse = {
  id: string;
  status: KycStatus;
  message?: string;
};

/** SEP-38: kilitli kur teklifi. */
export type Quote = {
  id: string;
  expires_at: string;
  /** Komisyon dahil efektif kur (TRY/USDC). */
  total_price: string;
  /** Komisyonsuz orta kur. */
  price: string;
  sell_asset: string;
  sell_amount: string;
  buy_asset: string;
  buy_amount: string;
  fee: {
    total: string;
    asset: string;
    details?: Array<{ name: string; description?: string; amount: string }>;
  };
};

/**
 * SEP-6 işlem durumları.
 *
 * Deposit:  pending_user_transfer_start -> pending_anchor -> completed
 *           (trustline yoksa pending_trust'ta bekler)
 * Withdraw: pending_user_transfer_start -> completed
 */
export type Sep6Status =
  | "incomplete"
  | "pending_user_transfer_start"
  | "pending_anchor"
  | "pending_trust"
  | "completed"
  | "error";

/** Deposit talimatı: kullanıcının TRY'yi nereye, hangi açıklamayla göndereceği. */
export type DepositInstructions = {
  /** Havale yapılacak IBAN. */
  bank_account_number?: { value: string; description?: string };
  /** Havale AÇIKLAMASINA yazılacak referans kodu — parayı hesaba bağlar. */
  external_transfer_memo?: { value: string; description?: string };
  [key: string]: { value: string; description?: string } | undefined;
};

export type DepositResponse = {
  id: string;
  how?: string;
  eta?: number;
  min_amount?: number;
  max_amount?: number;
  fee_percent?: number;
  instructions?: DepositInstructions;
  extra_info?: { message?: string };
};

/** Withdraw: USDC'nin gönderileceği hazine adresi + eşleştirme memo'su. */
export type WithdrawResponse = {
  id: string;
  account_id: string;
  memo: string;
  memo_type?: string;
  eta?: number;
  min_amount?: number;
  max_amount?: number;
  fee_percent?: number;
  extra_info?: { message?: string };
};

export type Sep6Transaction = {
  id: string;
  kind: "deposit" | "withdrawal";
  status: Sep6Status;
  status_eta?: number;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  external_transaction_id?: string;
  more_info_url?: string;
  message?: string;
};

/** Bir işlemi imzalayan fonksiyon — cüzdan katmanından enjekte edilir. */
export type SignXdr = (xdr: string) => Promise<string>;

export class AnchorError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly endpoint?: string,
  ) {
    super(message);
    this.name = "AnchorError";
  }
}
