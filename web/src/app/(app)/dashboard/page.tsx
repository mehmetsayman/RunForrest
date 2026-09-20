"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Award,
  ChevronRight,
  Clock,
  Flame,
  Footprints,
  MapPin,
  Medal,
  Route,
  Target,
  Trophy,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { QuickAction } from "@/components/dashboard/quick-action";
import { ConnectButton } from "@/components/wallet/connect-button";
import { useWallet } from "@/hooks/use-wallet";
import { useBadges, TIER_META } from "@/hooks/use-badges";
import { useActiveChallengeId, useChallenge } from "@/hooks/use-challenge";
import { RunMap } from "@/components/map/dynamic-map";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ─── MOCK DATA ─── */

/* ─── HELPERS ─── */

/**
 * Time-of-day greeting.
 *
 * It cannot be read during render: the server's hour and the browser's
 * hour disagree, which produces a hydration mismatch. It is computed
 * after mount instead, so the first paint shows a neutral greeting.
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

type DbRun = {
  id: string;
  wallet_address: string;
  distance_meters: number;
  duration_seconds: number;
  pace: string | null;
  calories: number | null;
  avg_speed: number | null;
  positions: [number, number][] | null;
  created_at: string;
};

/* ─── PAGE ─── */

export default function DashboardPage() {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(getGreeting());
  }, []);
  const { isConnected, displayAddress, address } = useWallet();
  // Every number comes from chain. With no data we show "—" rather than inventing one.
  const badges = useBadges(address);
  const { id: activeId } = useActiveChallengeId();
  const active = useChallenge(activeId);
  const [dbRuns, setDbRuns] = useState<DbRun[]>([]);

  /** My own progress in the active challenge, read from chain. */
  const myMeters = active.me?.distance_m ?? 0;
  const targetMeters = active.challenge?.target_distance_m ?? 0;
  const progressPct =
    targetMeters > 0 ? Math.min(100, (myMeters / targetMeters) * 100) : 0;

  /** This week's runs (when Supabase is configured). */
  const weekBuckets = (() => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (const r of dbRuns) {
      const d = new Date(r.created_at);
      const idx = Math.floor((d.getTime() - monday.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) out[idx] += r.distance_meters / 1000;
    }
    return out;
  })();
  const weekTotal = weekBuckets.reduce((a, b) => a + b, 0);

  useEffect(() => {
    // Supabase is optional: without it the run history stays empty and
    // everything backed by the chain keeps working.
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        if (data && data.length > 0) setDbRuns(data);
      } catch {
        /* history unavailable — the page still works */
      }
    })();
  }, []);

  return (
    <MobileContainer withNav className="space-y-5 pt-6 pb-6">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 ring-2 ring-primary/40 animate-pulse-glow">
            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-[#ffb224]/30 text-base font-bold text-primary">
              {isConnected ? displayAddress.slice(0, 2).toUpperCase() : "RN"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{greeting} 🏃</p>
            <p className="text-xs text-muted-foreground">
              {isConnected ? (
                <span className="font-mono font-medium text-primary">{displayAddress}</span>
              ) : (
                <span className="font-medium">Wallet not connected</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary"
            >
              <Flame className="size-3" />
              {badges.totalRuns} verified runs
            </Badge>
          ) : (
            <ConnectButton variant="compact" />
          )}
        </div>
      </div>

      {/* ─── CHALLENGE PROGRESS (Main Hero Card) ─── */}
      <GlassCard strong glow className="relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-[60px]" />
        <div className="relative flex items-center gap-5">
          <ProgressRing
            value={myMeters / 1000}
            max={Math.max(1, targetMeters / 1000)}
            size={110}
            strokeWidth={7}
            icon={<Target className="mb-0.5 size-5 text-primary" />}
            label={`${Math.round(progressPct)}%`}
            sublabel={`${(myMeters / 1000).toFixed(1)} / ${(targetMeters / 1000).toFixed(0)} km`}
          />
          <div className="flex-1">
            <Badge className="mb-2 border-0 bg-primary/20 text-[10px] text-primary">
              <Zap className="mr-1 size-3" />
              {activeId !== null ? `Challenge #${activeId}` : "No active challenge"}
            </Badge>
            <p className="text-2xl font-bold tabular-nums">
              {(myMeters / 1000).toFixed(1)}{" "}
              <span className="text-base font-normal text-muted-foreground">km</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {!active.joined
                ? "Not joined yet"
                : `${Math.max(0, (targetMeters - myMeters) / 1000).toFixed(1)} km to go`}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-stellar-light to-primary transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ─── ANIMATED STATS GRID ─── */}
      <div className="grid grid-cols-2 gap-2.5">
        <AnimatedStat
          label="Verified distance"
          value={`${badges.totalKm} km`}
          icon={Route}
          delay={0}
        />
        <AnimatedStat
          label="Verified runs"
          value={String(badges.totalRuns)}
          icon={Flame}
          delay={80}
        />
        <AnimatedStat
          label="Cities"
          value={String(badges.cities)}
          icon={Activity}
          delay={160}
        />
        <AnimatedStat
          label="Badges"
          value={String(badges.collection.length)}
          icon={Award}
          delay={240}
        />
      </div>

      {/* ─── QUICK ACTIONS ─── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Quick Actions</h2>
        <QuickAction
          href="/run"
          icon={Footprints}
          label="Start Run"
          description="Begin GPS tracking"
          variant="primary"
        />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction
            href="/run"
            icon={Upload}
            label="Upload"
            description="Import GPX from Strava"
          />
          <QuickAction
            href="/leaderboard"
            icon={Trophy}
            label="Leaderboard"
            description="View rankings"
          />
        </div>
      </section>

      {/* ─── WEEKLY OVERVIEW (Mini rings) ─── */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Bu hafta</h2>
          <span className="text-xs font-medium text-primary">
            {weekTotal.toFixed(1)} km
          </span>
        </div>
        <div className="flex items-center justify-between">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
            const values = weekBuckets;
            const hasRun = values[i] > 0;
            const isToday = i === (new Date().getDay() + 6) % 7;
            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <ProgressRing
                  value={values[i]}
                  max={10}
                  size={36}
                  strokeWidth={3}
                  icon={
                    hasRun ? (
                      <Footprints className="size-3 text-primary" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-white/20" />
                    )
                  }
                />
                <span
                  className={`text-[9px] font-medium ${
                    isToday
                      ? "text-primary"
                      : hasRun
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* ─── CITY BADGES ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">City badges</h2>
          <Link
            href="/profile"
            className="flex items-center gap-0.5 text-xs text-primary"
          >
            All <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {badges.collection.length === 0 && (
            <GlassCard className="w-full p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No badges yet — finish your first run in a city
              </p>
            </GlassCard>
          )}
          {badges.collection.map((badge, i) => {
            const meta = TIER_META[badge.tier];
            return (
              <GlassCard
                key={badge.city}
                glow={badge.tier === "Epic" || badge.tier === "Legendary"}
                className="min-w-[110px] shrink-0 p-3.5 text-center transition-all"
              >
                <div
                  className="mx-auto mb-2 flex size-12 animate-float-slow items-center justify-center rounded-2xl bg-primary/20"
                  style={{ animationDelay: `${i * 0.5}s` }}
                >
                  <MapPin className="size-5 text-primary" />
                </div>
                <p className="text-xs font-semibold">{badge.city}</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  Tier {meta.roman} · {badge.runs} runs
                </p>
                <Badge className={`mt-1.5 border-0 bg-white/10 text-[8px] ${meta.text}`}>
                  {meta.label}
                </Badge>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* ─── LAST RUN MAP (only when a real run exists) ─── */}
      {dbRuns.length > 0 && dbRuns[0].positions && (
      <GlassCard glow className="overflow-hidden p-0">
        <RunMap
          positions={dbRuns[0].positions}
          height="h-36"
          followUser={false}
          showMarkers
          interactive={false}
        />
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-xs font-semibold">Last run</p>
            <p className="text-[10px] text-muted-foreground">
              {`${(dbRuns[0].distance_meters / 1000).toFixed(2)} km · ${formatDuration(dbRuns[0].duration_seconds)} · ${timeAgo(dbRuns[0].created_at)}`}
            </p>
          </div>
          <Link href="/run" className="rounded-lg bg-primary/15 px-2.5 py-1.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/25">
            Details
          </Link>
        </div>
      </GlassCard>
      )}

      {/* ─── RECENT RUNS ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent runs</h2>
          <Link href="/run" className="text-xs text-primary">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {dbRuns.length === 0 && (
            <GlassCard className="p-6 text-center">
              <p className="text-sm">No runs recorded yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Finish your first run — your distance gets verified on Stellar
              </p>
            </GlassCard>
          )}
          {(dbRuns.length > 0 ? dbRuns.map((run) => ({
            id: run.id,
            title: `${(run.distance_meters / 1000).toFixed(1)}km Run`,
            city: "GPS",
            km: (run.distance_meters / 1000).toFixed(2),
            pace: run.pace ?? "--:--",
            time: formatDuration(run.duration_seconds),
            cal: run.calories ?? 0,
            date: timeAgo(run.created_at),
            badge: run.distance_meters >= 5000,
          })) : []).map((run) => (
            <GlassCard
              key={run.id}
              className="p-4 transition-all hover:border-primary/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
                      <Medal className="size-5 text-primary" />
                    </div>
                    {run.badge && (
                      <div className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-400">
                        <MapPin className="size-2.5 text-black" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{run.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.city} · {run.date}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { icon: Route, label: "Dist", value: `${run.km} km` },
                  { icon: Clock, label: "Time", value: run.time },
                  { icon: TrendingUp, label: "Pace", value: `${run.pace}/km` },
                  { icon: Flame, label: "Cal", value: `${run.cal}` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
                    <stat.icon className="mx-auto mb-0.5 size-3 text-primary" />
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    <p className="text-xs font-semibold tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ─── MOTIVATION BANNER ─── */}
      <GlassCard className="relative overflow-hidden p-5">
        <div className="absolute -right-6 -bottom-6 size-32 rounded-full bg-primary/10 blur-[40px]" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-[#ffb224]/30 animate-pulse-glow">
            <Zap className="size-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold">
              {badges.totalRuns === 0 ? "Let's get started" : "Keep going"}
            </p>
            <p className="text-xs text-muted-foreground">
              {badges.totalRuns === 0
                ? "Finish your first run — your distance gets verified on Stellar."
                : `${badges.totalKm} km verified across ${badges.cities} cities. Run in a new city to grow the collection.`}
            </p>
          </div>
        </div>
      </GlassCard>
    </MobileContainer>
  );
}
