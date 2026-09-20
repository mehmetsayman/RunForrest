"use client";

/**
 * City badge — read from chain.
 *
 * Every field comes from the `runforrest_badge` contract: city, run count,
 * total distance, tier and the dates it was earned.
 *
 * Badges are soulbound: if "proof of active lifestyle" can be bought, it is
 * not proof. The contract has no transfer function.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  ChevronRight,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Route,
  Shield,
  Sparkles,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { NeonButton } from "@/components/runforrest/neon-button";
import { Badge } from "@/components/ui/badge";
import { ConnectButton } from "@/components/wallet/connect-button";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useBadges, TIER_META } from "@/hooks/use-badges";
import { explorerContract, RUNFORREST_BADGE_ID } from "@/lib/stellar/config";
import { cn } from "@/lib/utils";

export default function MintPage() {
  const { address, isConnected } = useWallet();
  const badges = useBadges(address);

  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCard(true), 150);
    return () => clearTimeout(t);
  }, []);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setTiltX(((e.clientY - r.top) / r.height - 0.5) * -12);
    setTiltY(((e.clientX - r.left) / r.width - 0.5) * 12);
  }

  /* ─── not connected ─── */
  if (!isConnected) {
    return (
      <MobileContainer withNav className="space-y-5 pb-6 pt-6">
        <GlassCard className="p-8 text-center">
          <Award className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 text-lg font-semibold">Your City Badges</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your wallet to see your badges
          </p>
          <div className="mt-5 flex justify-center">
            <ConnectButton />
          </div>
        </GlassCard>
      </MobileContainer>
    );
  }

  /* ─── loading ─── */
  if (badges.loading) {
    return (
      <MobileContainer withNav className="space-y-5 pb-6 pt-6">
        <GlassCard className="flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </GlassCard>
      </MobileContainer>
    );
  }

  /* ─── no badges yet ─── */
  if (badges.collection.length === 0) {
    return (
      <MobileContainer withNav className="space-y-5 pb-6 pt-6">
        <GlassCard className="p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/[0.04]">
            <MapPin className="size-7 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">No badges yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish your first run in a city and the badge gets written on chain.
          </p>
          <NeonButton className="mt-5 w-full justify-center gap-2" href="/run">
            <Route className="size-4" />
            Start running
          </NeonButton>
        </GlassCard>
      </MobileContainer>
    );
  }

  // Feature the most recently run city.
  const sorted = [...badges.collection].sort(
    (a, b) => Number(b.last_run) - Number(a.last_run),
  );
  const featured = sorted[0];
  const meta = TIER_META[featured.tier];
  const rest = sorted.slice(1);

  return (
    <MobileContainer withNav className="relative space-y-5 pb-6 pt-4">
      {/* ─── featured badge ─── */}
      <div
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setTiltX(0);
          setTiltY(0);
        }}
        style={{
          transform: `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
          transition: "transform 200ms ease-out",
        }}
        className={cn(
          "transition-opacity duration-700",
          showCard ? "opacity-100" : "opacity-0",
        )}
      >
        <GlassCard strong glow className="relative overflow-hidden p-6">
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-40",
              meta.gradient,
            )}
          />
          <div className="absolute -right-12 -top-12 size-44 rounded-full bg-primary/20 blur-[70px]" />

          <div className="relative text-center">
            <Badge className={cn("border-0 bg-white/10 text-[10px]", meta.text)}>
              {meta.label} · Tier {meta.roman}
            </Badge>

            <div className="mx-auto mt-4 flex size-20 items-center justify-center rounded-3xl bg-primary/20">
              <MapPin className="size-9 text-primary" />
            </div>

            <h1 className="mt-4 text-2xl font-bold">{featured.city}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {featured.runs} runs ·{" "}
              {(Number(featured.total_distance_m) / 1000).toFixed(1)} km
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  First earned
                </p>
                <p className="mt-1 text-xs font-medium">
                  {new Date(Number(featured.first_earned) * 1000).toLocaleDateString(
                    "en-US",
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Last run
                </p>
                <p className="mt-1 text-xs font-medium">
                  {new Date(Number(featured.last_run) * 1000).toLocaleDateString(
                    "en-US",
                  )}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ─── soulbound explainer ─── */}
      <GlassCard className="p-4">
        <div className="flex gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <Lock className="size-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Non-transferable badge</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              This badge cannot be sold or transferred — the contract has no
              transfer function. Proof of an active lifestyle is not proof if it can be bought.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ─── next tier ─── */}
      {featured.tier !== "Legendary" && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="size-4 text-primary" />
            <div className="flex-1">
              <p className="text-xs font-medium">Next tier</p>
              <p className="text-[11px] text-muted-foreground">
                {featured.tier === "Common"
                  ? `${6 - featured.runs} more runs → Rare`
                  : featured.tier === "Rare"
                    ? `${16 - featured.runs} more runs → Epic`
                    : `${26 - featured.runs} more runs → Legendary`}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ─── other cities ─── */}
      {rest.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Other cities</h2>
            <Link href="/profile" className="flex items-center text-xs text-primary">
              All <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {rest.map((b) => {
              const m = TIER_META[b.tier];
              return (
                <GlassCard key={b.city} className="relative overflow-hidden p-4">
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-25",
                      m.gradient,
                    )}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <MapPin className="size-4 text-primary" />
                      <Badge className={cn("border-0 bg-white/10 text-[8px]", m.text)}>
                        {m.label}
                      </Badge>
                    </div>
                    <p className="mt-2.5 text-sm font-semibold">{b.city}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.runs} runs · Tier {m.roman}
                    </p>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── verification ─── */}
      <GlassCard className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-primary" />
          <p className="text-sm font-medium">Verify on chain</p>
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Network</span>
            <span>Stellar Testnet</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Toplam</span>
            <span>
              {badges.cities} cities · {badges.totalRuns} runs · {badges.totalKm} km
            </span>
          </div>
        </div>
        <a
          href={explorerContract(RUNFORREST_BADGE_ID)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-xs font-medium transition-colors hover:bg-white/[0.12]"
        >
          <ExternalLink className="size-3.5" />
          View on Stellar.Expert
        </a>
      </GlassCard>
    </MobileContainer>
  );
}
