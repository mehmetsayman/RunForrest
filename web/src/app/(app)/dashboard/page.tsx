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
  const greeting = getGreeting();
  const { isConnected, displayAddress, address } = useWallet();
  // Sayılar zincirden; veri yoksa "—" gösteriyoruz, uydurmuyoruz.
  const badges = useBadges(address);
  const { id: activeId } = useActiveChallengeId();
  const active = useChallenge(activeId);
  const [dbRuns, setDbRuns] = useState<DbRun[]>([]);

  /** Aktif yarışmadaki kendi ilerlemem — zincirden. */
  const myMeters = active.me?.distance_m ?? 0;
  const targetMeters = active.challenge?.target_distance_m ?? 0;
  const progressPct =
    targetMeters > 0 ? Math.min(100, (myMeters / targetMeters) * 100) : 0;

  /** Bu haftanın koşuları (Supabase varsa). */
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
    // Supabase opsiyonel: yapılandırılmamışsa koşu geçmişi boş kalır,
    // zincire dayalı her şey çalışmaya devam eder.
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
        /* geçmiş okunamadı — sayfa yine de çalışır */
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
                <span className="font-medium">Cüzdan bağlı değil</span>
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
              {badges.totalRuns} doğrulanmış koşu
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
              {activeId !== null ? `Yarışma #${activeId}` : "Aktif yarışma yok"}
            </Badge>
            <p className="text-2xl font-bold tabular-nums">
              {(myMeters / 1000).toFixed(1)}{" "}
              <span className="text-base font-normal text-muted-foreground">km</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {!active.joined
                ? "Henüz katılmadın"
                : `${Math.max(0, (targetMeters - myMeters) / 1000).toFixed(1)} km kaldı`}
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
          label="Doğrulanmış mesafe"
          value={`${badges.totalKm} km`}
          icon={Route}
          delay={0}
        />
        <AnimatedStat
          label="Doğrulanmış koşu"
          value={String(badges.totalRuns)}
          icon={Flame}
          delay={80}
        />
        <AnimatedStat
          label="Şehir"
          value={String(badges.cities)}
          icon={Activity}
          delay={160}
        />
        <AnimatedStat
          label="Rozet"
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
            description="Import GPX/FIT"
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
          {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day, i) => {
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
          <h2 className="text-sm font-semibold">Şehir rozetleri</h2>
          <Link
            href="/profile"
            className="flex items-center gap-0.5 text-xs text-primary"
          >
            Tümü <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {badges.collection.length === 0 && (
            <GlassCard className="w-full p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Henüz rozetin yok — bir şehirde ilk koşunu tamamla
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
                  Tier {meta.roman} · {badge.runs} koşu
                </p>
                <Badge className={`mt-1.5 border-0 bg-white/10 text-[8px] ${meta.text}`}>
                  {meta.label}
                </Badge>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* ─── SON KOŞU HARİTASI (yalnızca gerçek koşu varsa) ─── */}
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
            <p className="text-xs font-semibold">Son koşu</p>
            <p className="text-[10px] text-muted-foreground">
              {`${(dbRuns[0].distance_meters / 1000).toFixed(2)} km · ${formatDuration(dbRuns[0].duration_seconds)} · ${timeAgo(dbRuns[0].created_at)}`}
            </p>
          </div>
          <Link href="/run" className="rounded-lg bg-primary/15 px-2.5 py-1.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/25">
            Detay
          </Link>
        </div>
      </GlassCard>
      )}

      {/* ─── SON KOŞULAR ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Son koşular</h2>
          <Link href="/run" className="text-xs text-primary">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {dbRuns.length === 0 && (
            <GlassCard className="p-6 text-center">
              <p className="text-sm">Henüz kayıtlı koşun yok</p>
              <p className="mt-1 text-xs text-muted-foreground">
                İlk koşunu tamamla — mesafen Stellar üzerinde doğrulansın
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
              {badges.totalRuns === 0 ? "Hadi başlayalım" : "Devam et"}
            </p>
            <p className="text-xs text-muted-foreground">
              {badges.totalRuns === 0
                ? "İlk koşunu tamamla — mesafen Stellar üzerinde doğrulansın."
                : `${badges.totalKm} km doğrulandı, ${badges.cities} şehir. Yeni bir şehirde koş, koleksiyonu büyüt.`}
            </p>
          </div>
        </div>
      </GlassCard>
    </MobileContainer>
  );
}
