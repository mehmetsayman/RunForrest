"use client";

/**
 * TRY → USDC deposit flow.
 *
 * The anchor does not speak SEP-24, so this sheet is ours: the runner never
 * leaves RunForrest and never lands in an iframe. It opens at the moment of
 * joining: with no USDC, the "Join" button drops straight into this flow.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Copy,
  Loader2,
  Landmark,
  Sparkles,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/runforrest/glass-card";
import { useAnchor } from "@/hooks/use-anchor";
import { useWallet } from "@/components/wallet/wallet-provider";
import { ANCHOR_LIMITS } from "@/lib/stellar/config";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  /** USDC the runner is short of — the suggested amount is derived from it. */
  neededUsdc?: string;
  /** Called once USDC lands in the wallet (e.g. resume the join). */
  onFunded?: () => void;
};

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 break-all font-mono text-sm">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="shrink-0 rounded-lg bg-white/[0.06] p-2 transition-colors hover:bg-white/[0.12]"
          aria-label={`${label} kopyala`}
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Copy className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  incomplete: "Starting",
  pending_user_transfer_start: "Waiting for your transfer",
  pending_anchor: "Anchor processing",
  pending_trust: "Waiting for USDC trustline",
  completed: "Completed",
  error: "Failed",
};

export function OnRampSheet({ open, onClose, neededUsdc, onFunded }: Props) {
  const { address, hasTrustline, isActivated, addTrustline, activateAccount, refresh } =
    useWallet();
  const ramp = useAnchor(address);
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [trustBusy, setTrustBusy] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);

  /**
   * Suggested TRY amount for the USDC the runner needs.
   *
   * Derived rather than copied from prop into state; the moment the user
   * types something, their value takes over.
   *
   * The margin is needed: the rate can move mid-flow and the anchor takes a
   * 0.5% fee. Sending an exact amount would leave the runner just under the
   * USDC they were aiming for, the join would be rejected again, and they
   * would land back on this sheet.
   */
  const suggestedTry = useMemo(() => {
    const STEP = 50; // round to a tidy bank-transfer amount
    if (!neededUsdc) return String(ANCHOR_LIMITS.minOnrampTry * 10);
    const APPROX_RATE = 50; // TRY/USDC — deliberately conservative
    const withMargin = Number(neededUsdc) * APPROX_RATE * 1.02;
    const rounded = Math.ceil(withMargin / STEP) * STEP;
    return String(
      Math.min(
        ANCHOR_LIMITS.maxOnrampTry,
        Math.max(ANCHOR_LIMITS.minOnrampTry, rounded),
      ),
    );
  }, [neededUsdc]);

  const amountTry = typedAmount ?? suggestedTry;
  const setAmountTry = setTypedAmount;

  const amountNum = Number(amountTry);
  const amountValid =
    Number.isFinite(amountNum) &&
    amountNum >= ANCHOR_LIMITS.minOnrampTry &&
    amountNum <= ANCHOR_LIMITS.maxOnrampTry;

  const busy = useMemo(
    () => ["authenticating", "quoting", "processing"].includes(ramp.step),
    [ramp.step],
  );

  useEffect(() => {
    if (ramp.step === "done") {
      // Refresh the wallet first, then tell the caller.
      (async () => {
        await refresh();
        onFunded?.();
      })();
    }
    // onFunded/refresh identities can change every render; the step is trigger enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramp.step]);

  if (!open) return null;

  const instructions = ramp.deposit?.instructions;
  const iban = instructions?.bank_account_number?.value;
  const reference = instructions?.external_transfer_memo?.value;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md px-3 pb-3 sm:px-0 sm:pb-0">
        <GlassCard strong className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Top up with Turkish Lira</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Send TRY by bank transfer, receive USDC in your wallet
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/[0.08]"
              aria-label="Kapat"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Step 0 — the account. On Stellar an account does not exist on chain
              until it holds the minimum XLM reserve; skip this and the trustline 404s. */}
          {!isActivated && (
            <div className="mb-4 rounded-xl border border-primary/25 bg-primary/10 p-3">
              <div className="flex gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-foreground">
                    Your Stellar account is not activated yet. One click does it —
                    free, because this is testnet.
                  </p>
                  <button
                    type="button"
                    disabled={activateBusy}
                    onClick={async () => {
                      setActivateBusy(true);
                      try {
                        await activateAccount();
                      } finally {
                        setActivateBusy(false);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/30 disabled:opacity-50"
                  >
                    {activateBusy && <Loader2 className="size-3 animate-spin" />}
                    Activate your account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — trustline: the one-time prerequisite for receiving USDC */}
          {isActivated && !hasTrustline && (
            <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="flex gap-2.5">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div className="flex-1">
                  <p className="text-xs text-amber-200">
                    Your account needs a one-time trustline before it can hold USDC.
                  </p>
                  <button
                    type="button"
                    disabled={trustBusy}
                    onClick={async () => {
                      setTrustBusy(true);
                      try {
                        await addTrustline();
                      } finally {
                        setTrustBusy(false);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {trustBusy && <Loader2 className="size-3 animate-spin" />}
                    Enable USDC
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── 1. amount ─── */}
          {ramp.step === "idle" ||
          ramp.step === "authenticating" ||
          ramp.step === "quoting" ? (
            <>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Amount you send
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 focus-within:border-primary/40">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountTry}
                  onChange={(e) => setAmountTry(e.target.value)}
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                />
                <span className="text-sm font-medium text-muted-foreground">TRY</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[500, 1000, 1500, 3000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountTry(String(v))}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] transition-colors",
                      amountTry === String(v)
                        ? "bg-primary/20 text-primary"
                        : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.1]",
                    )}
                  >
                    {v.toLocaleString("en-US")} ₺
                  </button>
                ))}
              </div>

              {!amountValid && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Amount must be between {ANCHOR_LIMITS.minOnrampTry}–
                  {ANCHOR_LIMITS.maxOnrampTry.toLocaleString("en-US")} TRY
                </p>
              )}

              <button
                type="button"
                disabled={!amountValid || busy || !hasTrustline || !isActivated}
                onClick={() => ramp.startOnRamp(amountTry)}
                className="neon-glow mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {ramp.step === "authenticating" ? "Authenticating…" : "Fetching rate…"}
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                Rate locks when the transfer starts · fee 
                {ANCHOR_LIMITS.feePercent}
              </p>
            </>
          ) : null}

          {/* ─── 2. transfer instructions ─── */}
          {ramp.step === "awaiting_transfer" && ramp.deposit && (
            <>
              {ramp.quote && (
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">You send</span>
                    <span className="font-semibold">
                      {Number(ramp.quote.sell_amount).toLocaleString("en-US")} ₺
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">You receive</span>
                    <span className="text-lg font-bold text-primary">
                      {Number(ramp.quote.buy_amount).toFixed(2)} USDC
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Kilitli kur: 1 USDC = {Number(ramp.quote.total_price).toFixed(2)} ₺
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {iban && (
                  <CopyRow
                    label="IBAN"
                    value={iban}
                    hint={instructions?.bank_account_number?.description}
                  />
                )}
                {reference && (
                  <CopyRow
                    label="Reference code"
                    value={reference}
                    hint="Put this in the transfer reference, or the payment cannot be matched to you"
                  />
                )}
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex gap-2.5">
                  <Landmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    This is a <strong>test environment</strong>: no real money moves.
                    Continue as if you had sent the transfer — with a real anchor your
                    bank performs this step.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => ramp.confirmBankTransfer()}
                className="neon-glow mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Building2 className="size-4" />
                I sent the transfer
              </button>
            </>
          )}

          {/* ─── 3. processing ─── */}
          {ramp.step === "processing" && (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium">
                {STATUS_LABEL[ramp.tx?.status ?? ""] ?? "Processing"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The anchor is confirming your payment and sending USDC
              </p>
              {ramp.tx?.status && (
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                  {ramp.tx.status}
                </p>
              )}
            </div>
          )}

          {/* ─── 4. bitti ─── */}
          {ramp.step === "done" && (
            <div className="py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="size-7 text-emerald-400" />
              </div>
              <p className="mt-3 text-lg font-semibold">
                {Number(ramp.tx?.amount_out ?? 0).toFixed(2)} USDC geldi
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ready to use in your wallet
              </p>
              {ramp.tx?.stellar_transaction_id && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${ramp.tx.stellar_transaction_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block font-mono text-[10px] text-primary hover:underline"
                >
                  {ramp.tx.stellar_transaction_id.slice(0, 20)}… ↗
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-xl bg-white/[0.06] py-3 text-sm font-medium transition-colors hover:bg-white/[0.12]"
              >
                Kapat
              </button>
            </div>
          )}

          {/* ─── error ─── */}
          {ramp.step === "error" && (
            <div className="py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-500/15">
                <AlertCircle className="size-7 text-red-400" />
              </div>
              <p className="mt-3 text-sm font-medium">Transfer could not be completed</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {ramp.error}
              </p>
              <button
                type="button"
                onClick={ramp.reset}
                className="mt-5 w-full rounded-xl bg-white/[0.06] py-3 text-sm font-medium transition-colors hover:bg-white/[0.12]"
              >
                Tekrar dene
              </button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
