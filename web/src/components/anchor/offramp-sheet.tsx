"use client";

/**
 * USDC → TRY çekme akışı.
 *
 * On-ramp'in aynası. Kazancını banka hesabına çekmek isteyen koşucu için:
 * kur kilitlenir, anchor bir hazine adresi + memo verir, uygulama USDC'yi
 * o memo ile gönderir, anchor eşleştirip TRY'yi IBAN'a öder.
 *
 * DİKKAT: memo tipi "id" — metin memo ile gönderilen ödeme eşleşmez ve para
 * kaybolur. `useAnchor.sendWithdrawPayment` bunu `Memo.id()` ile kuruyor.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  Loader2,
  Send,
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
};

const STATUS_LABEL: Record<string, string> = {
  incomplete: "Başlatılıyor",
  pending_user_transfer_start: "Ödemen bekleniyor",
  pending_anchor: "Anchor işliyor",
  completed: "Tamamlandı",
  error: "Hata",
};

/** Anchor'ın mesajından hedef IBAN'ı ayıklar (sandbox kendi seçiyor). */
function ibanFrom(message?: string): string | null {
  return message?.match(/TR\d{24}/)?.[0] ?? null;
}

export function OffRampSheet({ open, onClose }: Props) {
  const { address, balance, balanceFormatted, refresh } = useWallet();
  const ramp = useAnchor(address);
  const [amount, setAmount] = useState("5");

  const max = Number(balanceFormatted);
  const amountNum = Number(amount);
  const amountValid =
    Number.isFinite(amountNum) &&
    amountNum >= 1 &&
    amountNum <= Math.min(max, ANCHOR_LIMITS.maxUsdc);

  const busy = useMemo(
    () => ["authenticating", "quoting", "processing"].includes(ramp.step),
    [ramp.step],
  );

  useEffect(() => {
    if (ramp.step === "done") refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramp.step]);

  if (!open) return null;

  /**
   * Off-ramp teklifinde `total_price` ters yönde geliyor (USDC başına değil,
   * TRY başına). Kullanıcıya anlamlı kuru göstermek için buy/sell oranını
   * hesaplıyoruz: 5 USDC → 242.70 TRY ise 48.54 ₺/USDC.
   */
  const tryPerUsdc =
    ramp.quote && Number(ramp.quote.sell_amount) > 0
      ? Number(ramp.quote.buy_amount) / Number(ramp.quote.sell_amount)
      : null;

  const iban = ibanFrom(ramp.withdraw?.extra_info?.message);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md px-3 pb-3 sm:px-0 sm:pb-0">
        <GlassCard strong className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Banka hesabına çek</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                USDC gönder, IBAN&apos;ına Türk Lirası gelsin
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

          {/* ─── 1. tutar ─── */}
          {(ramp.step === "idle" ||
            ramp.step === "authenticating" ||
            ramp.step === "quoting") && (
            <>
              <div className="mb-3 flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Bakiyen</span>
                <span className="font-semibold">{max.toFixed(2)} USDC</span>
              </div>

              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Çekilecek tutar
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 focus-within:border-primary/40">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                />
                <span className="text-sm font-medium text-muted-foreground">USDC</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[5, 10, 25].map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={v > max}
                    onClick={() => setAmount(String(v))}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] transition-colors disabled:opacity-30",
                      amount === String(v)
                        ? "bg-primary/20 text-primary"
                        : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.1]",
                    )}
                  >
                    {v} USDC
                  </button>
                ))}
                <button
                  type="button"
                  disabled={max < 1}
                  onClick={() => setAmount(String(Math.floor(max * 100) / 100))}
                  className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.1] disabled:opacity-30"
                >
                  Tümü
                </button>
              </div>

              {!amountValid && (
                <p className="mt-2 text-[11px] text-amber-400">
                  {max < 1
                    ? "Çekmek için en az 1 USDC gerekiyor"
                    : `Tutar 1 – ${Math.min(max, ANCHOR_LIMITS.maxUsdc).toFixed(2)} USDC arasında olmalı`}
                </p>
              )}

              <button
                type="button"
                disabled={!amountValid || busy}
                onClick={() => ramp.startOffRamp(amount)}
                className="neon-glow mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {ramp.step === "authenticating"
                      ? "Kimlik doğrulanıyor…"
                      : "Kur alınıyor…"}
                  </>
                ) : (
                  <>
                    Devam et <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                Kur işlem başlatıldığında kilitlenir · komisyon %
                {ANCHOR_LIMITS.feePercent}
              </p>
            </>
          )}

          {/* ─── 2. ödemeyi onayla ─── */}
          {ramp.step === "awaiting_payment" && ramp.withdraw && (
            <>
              {ramp.quote && (
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Göndereceğin</span>
                    <span className="font-semibold">
                      {Number(ramp.quote.sell_amount).toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Alacağın</span>
                    <span className="text-lg font-bold text-primary">
                      {Number(ramp.quote.buy_amount).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ₺
                    </span>
                  </div>
                  {tryPerUsdc && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Kilitli kur: 1 USDC = {tryPerUsdc.toFixed(2)} ₺
                    </p>
                  )}
                </div>
              )}

              {iban && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Paranın gideceği IBAN
                  </p>
                  <p className="mt-1 break-all font-mono text-sm">{iban}</p>
                </div>
              )}

              <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex gap-2.5">
                  <Banknote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Onayladığında USDC anchor&apos;ın hazinesine eşleştirme memo&apos;su
                    ile gönderilir. Cüzdanın imza soracak. Bu bir{" "}
                    <strong>test ortamı</strong> — gerçek para hareket etmiyor.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => ramp.sendWithdrawPayment(amount)}
                className="neon-glow mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Send className="size-4" />
                USDC&apos;yi gönder
              </button>
            </>
          )}

          {/* ─── 3. işleniyor ─── */}
          {ramp.step === "processing" && (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium">
                {STATUS_LABEL[ramp.tx?.status ?? ""] ?? "İşleniyor"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anchor ödemeyi bekliyor, sonra TRY&apos;yi gönderecek
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
                {Number(ramp.tx?.amount_out ?? 0).toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ₺ gönderildi
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {iban ? `${iban} hesabına` : "Banka hesabına"}
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

          {/* ─── hata ─── */}
          {ramp.step === "error" && (
            <div className="py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-500/15">
                <AlertCircle className="size-7 text-red-400" />
              </div>
              <p className="mt-3 text-sm font-medium">İşlem tamamlanamadı</p>
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
