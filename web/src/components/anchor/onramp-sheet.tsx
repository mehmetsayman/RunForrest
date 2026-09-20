"use client";

/**
 * TRY → USDC yatırma akışı.
 *
 * Anchor SEP-24 konuşmadığı için bu ekran bize ait — kullanıcı RunForrest'dan
 * çıkmıyor, bir iframe'e atlamıyor. Akış katılım anında açılıyor: koşucunun
 * USDC'si yoksa "Katıl" butonu doğrudan buraya düşüyor.
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
  /** Kullanıcının ihtiyacı olan USDC — tutar buna göre önerilir. */
  neededUsdc?: string;
  /** USDC cüzdana düştüğünde çağrılır (ör. katılıma devam et). */
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
  incomplete: "Başlatılıyor",
  pending_user_transfer_start: "Havaleniz bekleniyor",
  pending_anchor: "Anchor işliyor",
  pending_trust: "USDC için izin bekleniyor",
  completed: "Tamamlandı",
  error: "Hata",
};

export function OnRampSheet({ open, onClose, neededUsdc, onFunded }: Props) {
  const { address, hasTrustline, isActivated, addTrustline, activateAccount, refresh } =
    useWallet();
  const ramp = useAnchor(address);
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [trustBusy, setTrustBusy] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);

  /**
   * Gereken USDC için önerilen TRY tutarı.
   *
   * Prop'tan state'e kopyalamak yerine türetiliyor; kullanıcı bir şey
   * yazdığı anda onun değeri geçerli olur.
   *
   * Paya ihtiyaç var: kur işlem sırasında oynayabilir ve anchor %0.5
   * komisyon alıyor. Tam denk bir tutar gönderilirse kullanıcı hedeflediği
   * USDC'nin biraz altında kalır, katılım yine reddedilir ve bu ekrana
   * geri düşer.
   */
  const suggestedTry = useMemo(() => {
    const STEP = 50; // düzgün bir havale tutarına yuvarla
    if (!neededUsdc) return String(ANCHOR_LIMITS.minOnrampTry * 10);
    const APPROX_RATE = 50; // TRY/USDC — bilinçli olarak temkinli
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
      // Önce cüzdanı tazele, sonra çağıranı bilgilendir.
      (async () => {
        await refresh();
        onFunded?.();
      })();
    }
    // onFunded/refresh kimliği her render değişebilir; adım yeterli tetikleyici.
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
              <h2 className="text-lg font-semibold">Türk Lirası ile yükle</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Banka havalesiyle TRY gönder, cüzdanına USDC gelsin
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

          {/* Adım 0 — hesap. Stellar'da hesap, minimum XLM rezervini alana
              kadar zincirde yoktur; bu atlanırsa trustline "Not Found" verir. */}
          {!isActivated && (
            <div className="mb-4 rounded-xl border border-primary/25 bg-primary/10 p-3">
              <div className="flex gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-foreground">
                    Stellar hesabın henüz açılmamış. Tek tıkla etkinleştir —
                    testnet olduğu için ücretsiz.
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
                    Hesabını etkinleştir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Adım 1 — trustline: USDC'yi alabilmek için tek seferlik ön koşul */}
          {isActivated && !hasTrustline && (
            <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="flex gap-2.5">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div className="flex-1">
                  <p className="text-xs text-amber-200">
                    USDC alabilmek için hesabında bir kerelik izin gerekiyor.
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
                    USDC&apos;yi etkinleştir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── 1. tutar ─── */}
          {ramp.step === "idle" ||
          ramp.step === "authenticating" ||
          ramp.step === "quoting" ? (
            <>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Göndereceğin tutar
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
                    {v.toLocaleString("tr-TR")} ₺
                  </button>
                ))}
              </div>

              {!amountValid && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Tutar {ANCHOR_LIMITS.minOnrampTry}–
                  {ANCHOR_LIMITS.maxOnrampTry.toLocaleString("tr-TR")} TRY arasında olmalı
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
                    {ramp.step === "authenticating" ? "Kimlik doğrulanıyor…" : "Kur alınıyor…"}
                  </>
                ) : (
                  <>
                    Devam et <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                Kur, işlem başlatıldığında kilitlenir · komisyon %
                {ANCHOR_LIMITS.feePercent}
              </p>
            </>
          ) : null}

          {/* ─── 2. havale talimatı ─── */}
          {ramp.step === "awaiting_transfer" && ramp.deposit && (
            <>
              {ramp.quote && (
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Göndereceğin</span>
                    <span className="font-semibold">
                      {Number(ramp.quote.sell_amount).toLocaleString("tr-TR")} ₺
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Alacağın</span>
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
                    label="Açıklama (referans kodu)"
                    value={reference}
                    hint="Havale açıklamasına bunu yazmazsan para hesabına bağlanamaz"
                  />
                )}
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex gap-2.5">
                  <Landmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Bu bir <strong>test ortamı</strong>: gerçek para hareket etmiyor.
                    Havaleyi yapmış gibi devam edebilirsin — gerçek bir anchor&apos;da
                    bu adımı bankan yapar.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => ramp.confirmBankTransfer()}
                className="neon-glow mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Building2 className="size-4" />
                Havaleyi yaptım
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
                Anchor ödemeyi doğrulayıp USDC&apos;yi gönderiyor
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
                Cüzdanında kullanıma hazır
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
