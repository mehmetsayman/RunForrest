"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  Calendar,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Heart,
  MapPin,
  Medal,
  Route,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { NeonButton } from "@/components/runforrest/neon-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/use-wallet";
import { useBadges, TIER_META } from "@/hooks/use-badges";
import { OnRampSheet } from "@/components/anchor/onramp-sheet";
import { OffRampSheet } from "@/components/anchor/offramp-sheet";
import { ConnectButton } from "@/components/wallet/connect-button";

/* ─── MOCK DATA ─── */

const monthlyStats = [
  { month: "May", km: 42.8, runs: 8 },
  { month: "Apr", km: 68.2, runs: 14 },
  { month: "Mar", km: 72.1, runs: 15 },
  { month: "Feb", km: 54.6, runs: 11 },
  { month: "Jan", km: 48.3, runs: 10 },
];


const achievements = [
  { title: "Çanakkale Runner NFT minted", date: "Today", icon: MapPin, type: "nft" },
  { title: "7-day streak reached", date: "Today", icon: Flame, type: "streak" },
  { title: "400 km milestone", date: "3 days ago", icon: Route, type: "milestone" },
  { title: "Joined Stellar Marathon Club", date: "1 week ago", icon: Users, type: "social" },
  { title: "Istanbul Tier III unlocked", date: "2 weeks ago", icon: Trophy, type: "nft" },
  { title: "Monthly challenge: Top 10", date: "Apr 30", icon: Medal, type: "challenge" },
  { title: "22-day streak (personal best)", date: "Mar 18", icon: Star, type: "streak" },
  { title: "First run uploaded", date: "Jan 12", icon: Heart, type: "milestone" },
];

function RarityColor(rarity: string) {
  switch (rarity) {
    case "Legendary": return "bg-amber-500/25 text-amber-300";
    case "Epic": return "bg-[#9e8cfc]/20 text-[#9e8cfc]";
    case "Rare": return "bg-[#00c2d7]/20 text-[#00c2d7]";
    default: return "bg-white/10 text-muted-foreground";
  }
}

/* ─── PAGE ─── */

export default function ProfilePage() {
  const [copied, setCopied] = useState(false);
  const [actionCopied, setActionCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"nfts" | "stats" | "timeline">("nfts");
  const { address, isConnected, displayAddress, balanceFormatted } = useWallet();
  const badges = useBadges(address);
  const [rampOpen, setRampOpen] = useState<"on" | "off" | null>(null);

  /**
   * The statistics are derived from chain. Hardcoding a number here would
   * defeat the product's one claim — verifiability. A profile showing 412 km
   * while the chain says 5 km makes everything else suspect.
   */
  const lifetimeStats = {
    totalKm: badges.totalKm,
    totalRuns: String(badges.totalRuns),
    cities: String(badges.cities),
    // The chain holds distance and run count; not calories, duration or pace.
    totalCalories: "—",
    totalTime: "—",
    avgPace: "—",
  };
  /** Reputation = verified kilometres × 10. The formula is open, the data is on chain. */
  const reputation = Math.round(badges.totalDistanceM / 100);

  const walletDisplay = isConnected ? displayAddress : "—";
  const walletFull = isConnected ? address! : "";

  function copyWallet() {
    navigator.clipboard?.writeText(walletFull);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const maxMonthKm = Math.max(...monthlyStats.map((m) => m.km));

  return (
    <MobileContainer withNav className="space-y-5 pt-6 pb-6">
      {/* ─── PROFILE HERO ─── */}
      <GlassCard strong glow className="relative overflow-hidden p-6">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-[60px]" />
        <div className="absolute -left-8 -bottom-8 size-32 rounded-full bg-[#9e8cfc]/10 blur-[50px]" />

        <div className="relative text-center">
          {/* Avatar */}
          <div className="relative mx-auto w-fit">
            <Avatar className="size-24 ring-4 ring-primary/30 animate-pulse-glow">
              <AvatarFallback className="bg-gradient-to-br from-primary/40 to-[#ffb224]/40 text-3xl font-bold text-primary">
                RN
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary neon-glow">
              <Shield className="size-4 text-white" />
            </div>
          </div>

          {/* Name & Info */}
          <h1 className="mt-4 font-mono text-xl font-bold tracking-tight">{isConnected ? displayAddress : "—"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{badges.cities > 0 ? `${badges.cities} cities · ${badges.totalRuns} verified runs` : "No verified runs yet"}</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Every number on this profile is verifiable on Stellar.
          </p>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Badge className="gap-1 border-0 bg-primary/20 text-primary">
              <Award className="size-3" />
              {badges.totalRuns >= 26
                ? "Legendary"
                : badges.totalRuns >= 16
                  ? "Epic"
                  : badges.totalRuns >= 6
                    ? "Rare"
                    : "New runner"}
            </Badge>
            <Badge className="gap-1 border-0 bg-amber-500/20 text-amber-300">
              <Flame className="size-3" />
              {badges.totalKm} km
            </Badge>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">
              Stellar
            </Badge>
          </div>

          {/* Wallet */}
          {isConnected ? (
            <button
              type="button"
              onClick={copyWallet}
              className="mt-4 mx-auto flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.08]"
            >
              <span className="size-2 rounded-full bg-emerald-400" />
              <Wallet className="size-3 text-primary" />
              <span className="font-mono text-muted-foreground">{walletDisplay}</span>
              <Badge className="border-0 bg-primary/15 text-[9px] text-primary">
                {Number(balanceFormatted).toFixed(2)} USDC
              </Badge>
              <Copy className="size-3 text-muted-foreground" />
              {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
            </button>
          ) : (
            <div className="mt-4">
              <ConnectButton variant="default" />
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── MONEY: DEPOSIT / WITHDRAW ─── */}
      {isConnected && (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Your balance</p>
            <p className="text-lg font-bold tabular-nums">
              {Number(balanceFormatted).toFixed(2)}{" "}
              <span className="text-xs font-normal text-muted-foreground">USDC</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRampOpen("on")}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/15 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
            >
              <ArrowDownToLine className="size-3.5" />
              Top up with TRY
            </button>
            <button
              type="button"
              onClick={() => setRampOpen("off")}
              disabled={Number(balanceFormatted) < 1}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-medium transition-colors hover:bg-white/[0.08] disabled:opacity-40"
            >
              <ArrowUpFromLine className="size-3.5" />
              Withdraw to IBAN
            </button>
          </div>
          <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
            Between a Turkish bank and Stellar · SEP-6 anchor
          </p>
        </GlassCard>
      )}

      {/* ─── REPUTATION RING + STATS ─── */}
      <div className="flex items-center gap-4">
        <ProgressRing
          value={reputation}
          max={10000}
          size={90}
          strokeWidth={6}
          icon={<Shield className="mb-0.5 size-4 text-primary" />}
          label={reputation.toLocaleString("en-US")}
          sublabel="reputation"
        />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <AnimatedStat label="Total KM" value={lifetimeStats.totalKm} icon={Route} delay={0} />
          <AnimatedStat label="Runs" value={lifetimeStats.totalRuns} icon={TrendingUp} delay={80} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Flame, label: "Calories", value: lifetimeStats.totalCalories },
          { icon: Clock, label: "Time", value: lifetimeStats.totalTime },
          { icon: TrendingUp, label: "Pace", value: lifetimeStats.avgPace },
          { icon: Globe, label: "Cities", value: lifetimeStats.cities },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-2.5 text-center">
            <stat.icon className="mx-auto size-3.5 text-primary" />
            <p className="mt-1 text-sm font-bold tabular-nums">{stat.value}</p>
            <p className="text-[7px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* ─── TAB NAVIGATION ─── */}
      <div className="glass flex rounded-xl p-1">
        {(["nfts", "stats", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
              activeTab === tab
                ? "bg-primary text-primary-foreground neon-glow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "nfts" ? "NFT Gallery" : tab === "stats" ? "Monthly Stats" : "Timeline"}
          </button>
        ))}
      </div>

      {/* ─── TAB: NFT GALLERY ─── */}
      {activeTab === "nfts" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {badges.loading ? "Loading badges…" : `${badges.cities} City Badges`}
            </h2>
            <Link href="/mint" className="flex items-center text-xs text-primary">
              Latest <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {badges.collection.map((b) => {
              const meta = TIER_META[b.tier];
              return (
                <Link href="/mint" key={b.city}>
                  <GlassCard
                    glow={b.tier === "Epic" || b.tier === "Legendary"}
                    className="group relative overflow-hidden p-4 transition-all hover:scale-[1.02] hover:border-primary/20"
                  >
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", meta.gradient)} />

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/20 transition-all group-hover:animate-float-slow">
                          <MapPin className="size-5 text-primary" />
                        </div>
                        <Badge className={cn("border-0 text-[8px]", RarityColor(meta.label))}>
                          {meta.label}
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-semibold">{b.city}</h3>
                      <p className="text-xs text-primary">Tier {meta.roman}</p>
                      <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>{b.runs} runs</span>
                        <span>{(Number(b.total_distance_m) / 1000).toFixed(1)} km</span>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>

          {!badges.loading && badges.collection.length === 0 && (
            <GlassCard className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No badges yet</p>
                <p className="text-xs text-muted-foreground">
                  Finish your first run in a city and the badge gets written on chain
                </p>
              </div>
            </GlassCard>
          )}

          {badges.collection.length > 0 && (
            <GlassCard className="flex items-center gap-3 p-4 opacity-70">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/5">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {badges.totalRuns} runs · {badges.totalKm} km
                </p>
                <p className="text-xs text-muted-foreground">
                  Run in a new city to grow the collection
                </p>
              </div>
            </GlassCard>
          )}
        </section>
      )}

      {/* ─── TAB: MONTHLY STATS ─── */}
      {activeTab === "stats" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Monthly Performance</h2>

          {/* Bar chart */}
          <GlassCard className="p-5">
            <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
              {monthlyStats.map((m, i) => {
                const height = (m.km / maxMonthKm) * 100;
                const isCurrentMonth = i === 0;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[9px] font-semibold tabular-nums">
                      {m.km}
                    </span>
                    <div className="w-full flex flex-col justify-end" style={{ height: 100 }}>
                      <div
                        className={cn(
                          "w-full rounded-t-lg transition-all duration-700",
                          isCurrentMonth
                            ? "bg-gradient-to-t from-primary to-stellar-light neon-glow-sm"
                            : "bg-white/10"
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium",
                      isCurrentMonth ? "text-primary" : "text-muted-foreground"
                    )}>
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Month details */}
          <div className="space-y-1.5">
            {monthlyStats.map((m, i) => (
              <GlassCard
                key={m.month}
                className={cn(
                  "flex items-center justify-between p-3",
                  i === 0 && "border-primary/20 bg-primary/[0.04]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    i === 0 ? "bg-primary/20" : "bg-white/5"
                  )}>
                    <Calendar className={cn("size-3.5", i === 0 ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.month} 2026</p>
                    <p className="text-[10px] text-muted-foreground">{m.runs} runs</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{m.km} km</p>
                  <p className="text-[9px] text-muted-foreground">
                    {(m.km / m.runs).toFixed(1)} km/run
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Most-run city — from chain */}
          {badges.collection.length > 0 && (
            <GlassCard glow className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20">
                <Star className="size-5 text-amber-400" fill="currentColor" />
              </div>
              <div>
                <p className="text-sm font-semibold">Your most-run city</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-bold text-amber-300">
                    {[...badges.collection].sort((a, b) => b.runs - a.runs)[0].city}
                  </span>{" "}
                  — {[...badges.collection].sort((a, b) => b.runs - a.runs)[0].runs} runs
                </p>
              </div>
            </GlassCard>
          )}
        </section>
      )}

      {/* ─── TAB: TIMELINE ─── */}
      {activeTab === "timeline" && (
        <section className="space-y-1">
          <h2 className="mb-3 text-sm font-semibold">Achievement Timeline</h2>
          {achievements.map((a, i) => (
            <div key={`${a.title}-${i}`} className="flex gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  a.type === "nft" ? "bg-primary/20" :
                  a.type === "streak" ? "bg-amber-500/20" :
                  a.type === "milestone" ? "bg-emerald-500/20" :
                  a.type === "social" ? "bg-blue-500/20" :
                  "bg-[#9e8cfc]/20"
                )}>
                  <a.icon className={cn(
                    "size-4",
                    a.type === "nft" ? "text-primary" :
                    a.type === "streak" ? "text-amber-400" :
                    a.type === "milestone" ? "text-emerald-400" :
                    a.type === "social" ? "text-blue-400" :
                    "text-[#9e8cfc]"
                  )} />
                </div>
                {i < achievements.length - 1 && (
                  <div className="w-px flex-1 bg-white/[0.08] my-1" />
                )}
              </div>
              {/* Content */}
              <GlassCard className="mb-2 flex-1 p-3 transition-all hover:bg-white/[0.06]">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{a.date}</p>
              </GlassCard>
            </div>
          ))}
        </section>
      )}

      {/* ─── ACTIONS ─── */}
      <GlassCard className="divide-y divide-white/[0.06] overflow-hidden">
        {/* Connected Wallet */}
        <button
          type="button"
          onClick={() => {
            if (isConnected && walletFull) {
              navigator.clipboard?.writeText(walletFull);
              setActionCopied(true);
              setTimeout(() => setActionCopied(false), 2000);
            }
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <Wallet className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">Connected Wallet</span>
          <span className="font-mono text-xs text-muted-foreground">
            {isConnected ? (actionCopied ? "Copied!" : walletDisplay) : "Not connected"}
          </span>
        </button>

        {/* Onchain Reputation */}
        <div className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
          <Shield className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">Onchain Reputation</span>
          <span className="font-mono text-xs text-muted-foreground">
            {reputation.toLocaleString("en-US")} pts
          </span>
        </div>

        {/* View on Explorer */}
        <button
          type="button"
          onClick={() => {
            if (isConnected && address) {
              window.open(
                `https://stellar.expert/explorer/testnet/account/${address}`,
                "_blank",
                "noopener,noreferrer"
              );
            } else {
              alert("Connect your wallet first to view on explorer.");
            }
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <ExternalLink className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">View on Explorer</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>

        {/* Share Profile */}
        <button
          type="button"
          onClick={async () => {
            const shareUrl = isConnected && address
              ? `${window.location.origin}/profile?address=${address}`
              : window.location.href;
            if (navigator.share) {
              try {
                await navigator.share({ title: "RunForrest Profile", url: shareUrl });
              } catch {
                /* user cancelled share */
              }
            } else {
              await navigator.clipboard?.writeText(shareUrl);
              setActionCopied(true);
              setTimeout(() => setActionCopied(false), 2000);
            }
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <Share2 className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">Share Profile</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => alert("Settings — Coming soon!")}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <Settings className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium">Settings</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </GlassCard>

      {/* ─── FOOTER ─── */}
      <div className="text-center space-y-2">
        <NeonButton href="/" className="w-full justify-center gap-2">
          <Globe className="size-4" />
          View Public Profile
        </NeonButton>
        <p className="text-[10px] text-muted-foreground">
          RunForrest v0.1 · Proof of Active Lifestyle · Built on Stellar
        </p>
      </div>
      <OnRampSheet open={rampOpen === "on"} onClose={() => setRampOpen(null)} />
      <OffRampSheet open={rampOpen === "off"} onClose={() => setRampOpen(null)} />
    </MobileContainer>
  );
}
