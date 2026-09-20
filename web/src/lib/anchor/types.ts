/**
 * TR Mock Anchor — SEP tipleri.
 *
 * These types were written from the real responses of the live anchor
 * (see docs/TECHNICAL-NOTES.md), not copied from the spec.
 */

/** SEP-1: endpoints discovered from stellar.toml. */
export type AnchorInfo = {
  webAuthEndpoint: string;
  transferServer: string;
  kycServer: string;
  quoteServer: string;
  signingKey: string;
  assetCode: string;
  assetIssuer: string;
};

/** SEP-10: the challenge response. */
export type Sep10Challenge = {
  transaction: string;
  network_passphrase: string;
};

/** SEP-12: KYC status. Auto-approved by this anchor. */
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
 * SEP-6 transaction statuses.
 *
 * Deposit:  pending_user_transfer_start -> pending_anchor -> completed
 *           (without a trustline it waits in pending_trust)
 * Withdraw: pending_user_transfer_start -> completed
 */
export type Sep6Status =
  | "incomplete"
  | "pending_user_transfer_start"
  | "pending_anchor"
  | "pending_trust"
  | "completed"
  | "error";

/** Deposit instructions: where the user sends TRY, and with what reference. */
export type DepositInstructions = {
  /** The IBAN to transfer to. */
  bank_account_number?: { value: string; description?: string };
  /** Reference code for the transfer DESCRIPTION — it links the money to the account. */
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

/** Withdraw: the treasury address to send USDC to, plus the matching memo. */
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

/** A function that signs a transaction — injected from the wallet layer. */
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
