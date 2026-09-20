"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  ShieldPlus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { GlassCard } from "@/components/runforrest/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/wallet/wallet-provider";
import { explorerAccount } from "@/lib/stellar/config";

type ConnectButtonProps = {
  variant?: "default" | "hero" | "compact";
  className?: string;
};

export function ConnectButton({
  variant = "default",
  className,
}: ConnectButtonProps) {
  const {
    address,
    isConnected,
    isConnecting,
    balanceFormatted,
    hasTrustline,
    isActivated,
    displayAddress,
    connect,
    disconnect,
    addTrustline,
    activateAccount,
  } = useWallet();

  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [trustBusy, setTrustBusy] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleActivate() {
    setActivateBusy(true);
    try {
      await activateAccount();
    } catch {
      /* the error is held in context */
    } finally {
      setActivateBusy(false);
    }
  }

  async function handleTrustline() {
    setTrustBusy(true);
    try {
      await addTrustline();
    } catch {
      /* the error is surfaced by the wallet provider */
    } finally {
      setTrustBusy(false);
    }
  }

  /* ─── not connected ─── */

  if (!isConnected) {
    const label = isConnecting ? "Connecting…" : "Connect Wallet";

    if (variant === "hero") {
      return (
        <button
          type="button"
          onClick={connect}
          disabled={isConnecting}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-medium text-foreground backdrop-blur transition-all hover:border-primary/30 hover:bg-white/10 active:scale-[0.97] disabled:opacity-50",
            className,
          )}
        >
          {isConnecting ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <Wallet className="size-4 text-primary" />
          )}
          {label}
        </button>
      );
    }

    if (variant === "compact") {
      return (
        <button
          type="button"
          onClick={connect}
          disabled={isConnecting}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/25 active:scale-[0.97] disabled:opacity-50",
            className,
          )}
        >
          {isConnecting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Wallet className="size-3.5" />
          )}
          {isConnecting ? "…" : "Connect"}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className={cn(
          "neon-glow inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50",
          className,
        )}
      >
        {isConnecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {label}
      </button>
    );
  }

  /* ─── connected ─── */

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium backdrop-blur transition-all hover:border-primary/20 hover:bg-white/10",
          className,
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full",
            !isActivated
              ? "animate-pulse bg-red-400"
              : hasTrustline
                ? "bg-emerald-400"
                : "animate-pulse bg-amber-400",
          )}
        />
        <span className="font-mono text-xs">{displayAddress}</span>
        <Badge className="ml-1 border-0 bg-primary/15 text-[9px] text-primary">
          {Number(balanceFormatted).toFixed(2)} USDC
        </Badge>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            showMenu && "rotate-180",
          )}
        />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-64">
            <GlassCard strong className="overflow-hidden p-0">
              <div className="border-b border-white/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20">
                    <Wallet className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{displayAddress}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isActivated ? "Stellar Testnet" : "Account not activated"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-white/[0.04] p-2.5 text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {Number(balanceFormatted).toFixed(4)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    USDC
                  </p>
                </div>

                {/* On Stellar an account DOES NOT EXIST until it holds the minimum
                    XLM reserve. This is the first step for any freshly created
                    wallet; skip it and the trustline fails with "Not Found". */}
                {!isActivated && (
                  <button
                    type="button"
                    onClick={handleActivate}
                    disabled={activateBusy}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary/20 px-3 py-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
                  >
                    {activateBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    {activateBusy ? "Activating…" : "Activate your account"}
                  </button>
                )}

                {/* The trustline is the second Stellar-specific prerequisite: without
                    it the anchor cannot send USDC and the deposit waits in pending_trust. */}
                {isActivated && !hasTrustline && (
                  <button
                    type="button"
                    onClick={handleTrustline}
                    disabled={trustBusy}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    {trustBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldPlus className="size-3.5" />
                    )}
                    {trustBusy ? "Enabling…" : "Enable USDC"}
                  </button>
                )}
              </div>

              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    copyAddress();
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-white/[0.06]"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground" />
                  )}
                  <span>{copied ? "Copied" : "Copy address"}</span>
                </button>

                <a
                  href={explorerAccount(address!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-white/[0.06]"
                >
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  <span>View on Explorer</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="size-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
