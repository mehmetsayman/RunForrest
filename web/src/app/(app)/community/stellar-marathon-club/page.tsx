"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Globe,
  MapPin,
  Route,
  Share2,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { NeonButton } from "@/components/runforrest/neon-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/* ─── MOCK DATA ─── */

const members = [
  { name: "ensar_runs", role: "Founder", km: 2840, pace: "4:32", streak: 64, online: true },
  { name: "ozan_flow", role: "Captain", km: 1920, pace: "4:45", streak: 42, online: true },
  { name: "elif_pace", role: "Captain", km: 1680, pace: "4:58", streak: 38, online: false },
  { name: "can_sprint", role: "Member", km: 1540, pace: "4:20", streak: 24, online: true },
  { name: "ayse_trail", role: "Member", km: 1320, pace: "4:55", streak: 30, online: true },
  { name: "deniz_ultra", role: "Member", km: 1180, pace: "5:02", streak: 18, online: false },
  { name: "mert_pace", role: "Member", km: 980, pace: "5:10", streak: 15, online: true },
  { name: "selin_run", role: "Member", km: 860, pace: "5:22", streak: 12, online: false },
];

const upcomingRuns = [
  {
    title: "Sunday Long Run",
    date: "May 18, Sun",
    time: "7:00 AM",
    distance: "21 km",
    location: "Çanakkale Kordon → Saat Kulesi",
    pace: "5:00 – 5:30/km",
    spots: 18,
    total: 50,
    difficulty: "Advanced",
  },
  {
    title: "Tempo Tuesday",
    date: "May 20, Tue",
    time: "6:30 AM",
    distance: "10 km",
    location: "Truva Yolu Parkuru",
    pace: "4:30 – 4:50/km",
    spots: 12,
    total: 30,
    difficulty: "Advanced",
  },
  {
    title: "Recovery Thursday",
    date: "May 22, Thu",
    time: "7:00 AM",
    distance: "8 km",
    location: "Caddebostan Coast",
    pace: "6:00 – 6:30/km",
    spots: 24,
    total: 40,
    difficulty: "All Levels",
  },
  {
    title: "Weekend Long Run",
    date: "May 25, Sun",
    time: "6:00 AM",
    distance: "30 km",
    location: "Çanakkale Sahil Koşusu",
    pace: "5:10 – 5:40/km",
    spots: 8,
    total: 35,
    difficulty: "Advanced",
  },
];

const clubStats = [
  { label: "Total Runs", value: "12,480", icon: Route, color: "text-primary" },
  { label: "Total KM", value: "186k", icon: TrendingUp, color: "text-emerald-400" },
  { label: "Active This Week", value: "342", icon: Flame, color: "text-amber-400" },
  { label: "Avg Pace", value: "4:52/km", icon: Timer, color: "text-blue-400" },
  { label: "NFTs Earned", value: "3,860", icon: Sparkles, color: "text-[#9e8cfc]" },
  { label: "Countries", value: "28", icon: Globe, color: "text-cyan-400" },
];

const milestones = [
  { title: "100K Club Milestone", date: "Apr 2026", description: "Club reached 100,000 collective km" },
  { title: "Global Expansion", date: "Mar 2026", description: "Members from 25+ countries" },
  { title: "Stellar Pro Launch", date: "Jan 2026", description: "Rise In x Stellar Pro Hackathon'da kuruldu" },
];

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    Founder: "bg-amber-500/20 text-amber-300",
    Captain: "bg-primary/20 text-primary",
    Member: "bg-white/10 text-muted-foreground",
  };
  return (
    <Badge className={cn("border-0 text-[8px]", styles[role] ?? "bg-white/10 text-muted-foreground")}>
      {role === "Founder" && <Crown className="mr-0.5 size-2" />}
      {role === "Captain" && <Star className="mr-0.5 size-2" />}
      {role}
    </Badge>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Advanced: "bg-amber-500/20 text-amber-300",
    "All Levels": "bg-primary/20 text-primary",
  };
  return (
    <Badge className={cn("border-0 text-[8px]", colors[level] ?? "bg-white/10 text-muted-foreground")}>
      {level}
    </Badge>
  );
}

/* ─── PAGE ─── */

export default function StellarMarathonClubPage() {
  const [joined, setJoined] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const visibleMembers = showAllMembers ? members : members.slice(0, 5);

  function handleJoin() {
    setJoined(true);
    setTimeout(() => setJoined(false), 3000);
  }

  return (
    <MobileContainer withNav className="space-y-5 pb-6">
      {/* ─── BACK BUTTON ─── */}
      <div className="sticky top-0 z-30 -mx-5 px-5 pt-6 pb-3 bg-gradient-to-b from-background via-background to-transparent">
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Community
        </Link>
      </div>

      {/* ─── HERO IMAGE ─── */}
      <div className="relative -mx-5 -mt-2 overflow-hidden rounded-b-3xl">
        <div className="relative aspect-[16/10] w-full">
          <Image
            src="/stellar-marathon-club.png"
            alt="Stellar Marathon Club ekibi"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-[#ffb224]/10" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Badge className="mb-2 border-0 bg-amber-500/20 text-[10px] text-amber-300 gap-0.5">
                <Sparkles className="size-2.5" />
                Advanced Club
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-gradient-stellar font-heading">
                Stellar Marathon Club
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                Çanakkale / Global
                <span className="mx-1">·</span>
                <Calendar className="size-3" />
                Stellar Pro Hackathon 2026'da kuruldu
              </p>
            </div>
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 backdrop-blur hover:bg-white/20 transition-colors"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Stellar Marathon Club", url: window.location.href });
                }
              }}
            >
              <Share2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── DESCRIPTION ─── */}
      <GlassCard strong className="p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Stellar üzerinde inşa eden mesafe koşucuları. We run together every Sunday and push each
          other to go further. Stellar Pro Hackathon'da doğdu, artık küresel bir koşu topluluğu
          on-chain.
        </p>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">1,204</span> members
          </span>
          <span className="flex items-center gap-1.5">
            <Route className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">8.4k</span> km/wk
          </span>
          <span className="flex items-center gap-1.5">
            <Flame className="size-3.5 text-amber-400" />
            <span className="font-semibold text-foreground">342</span> active
          </span>
        </div>
      </GlassCard>

      {/* ─── JOIN BUTTON ─── */}
      <NeonButton
        className={cn(
          "w-full justify-center gap-2 transition-all",
          joined && "bg-emerald-500 hover:bg-emerald-500/90"
        )}
        size="lg"
        onClick={handleJoin}
      >
        {joined ? (
          <>
            <Sparkles className="size-5" />
            Welcome to the Club!
          </>
        ) : (
          <>
            <Zap className="size-5" />
            Join Club
          </>
        )}
      </NeonButton>

      {/* ─── STATS GRID ─── */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Trophy className="size-4 text-primary" />
          Club Stats
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {clubStats.map((stat) => (
            <GlassCard key={stat.label} className="p-3 text-center">
              <stat.icon className={cn("mx-auto size-4", stat.color)} />
              <p className="mt-1.5 text-lg font-bold tracking-tight">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground">{stat.label}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ─── UPCOMING RUNS ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Calendar className="size-4 text-primary" />
            Upcoming Runs
          </h2>
          <span className="text-[10px] text-muted-foreground">{upcomingRuns.length} scheduled</span>
        </div>
        <div className="space-y-2.5">
          {upcomingRuns.map((run) => {
            const spotsPercent = ((run.total - run.spots) / run.total) * 100;
            return (
              <GlassCard key={run.title + run.date} className="p-4 transition-all hover:border-primary/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{run.title}</h3>
                      <DifficultyBadge level={run.difficulty} />
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="size-3" />
                        {run.date} · {run.time}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="size-3" />
                        {run.location}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Route className="size-3" />
                        {run.distance}
                        <span className="mx-0.5">·</span>
                        <Timer className="size-3" />
                        {run.pace}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
                      <Target className="size-5 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {Array.from({ length: Math.min(4, run.total - run.spots) }).map((_, i) => (
                        <Avatar key={i} className="size-5 border border-black">
                          <AvatarFallback className="bg-primary/25 text-[6px]">
                            R{i + 1}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{run.spots} spots left</span>
                  </div>
                  <NeonButton className="h-7 px-4 text-xs">RSVP</NeonButton>
                </div>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-stellar-light transition-all"
                    style={{ width: `${spotsPercent}%` }}
                  />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* ─── MEMBERS ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            Members
          </h2>
          <span className="text-[10px] text-muted-foreground">1,204 total</span>
        </div>
        <div className="space-y-2">
          {visibleMembers.map((member, idx) => (
            <GlassCard
              key={member.name}
              className="p-3.5 transition-all hover:border-primary/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 to-[#ffb224]/30 text-xs font-bold text-primary">
                      {member.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-black bg-emerald-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{member.name}</p>
                    <RoleBadge role={member.role} />
                    {idx < 3 && (
                      <span className="text-[9px] text-amber-400 font-medium">#{idx + 1}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Route className="size-2.5" />
                      {member.km.toLocaleString()} km
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="size-2.5" />
                      {member.pace}/km
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Flame className="size-2.5" />
                      {member.streak}d streak
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </GlassCard>
          ))}
        </div>
        {!showAllMembers && (
          <button
            type="button"
            onClick={() => setShowAllMembers(true)}
            className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
          >
            Show all members · 1,204
          </button>
        )}
      </section>

      {/* ─── MILESTONES ─── */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Star className="size-4 text-primary" />
          Milestones
        </h2>
        <div className="relative space-y-3">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
          {milestones.map((m) => (
            <div key={m.title} className="relative flex gap-4 pl-1">
              <div className="relative z-10 mt-1 flex size-[10px] shrink-0 items-center justify-center rounded-full bg-primary ring-4 ring-background">
                <div className="size-1.5 rounded-full bg-primary" />
              </div>
              <GlassCard className="flex-1 p-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{m.title}</h3>
                  <span className="text-[10px] text-muted-foreground">{m.date}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* ─── QUICK STATS FOOTER ─── */}
      <GlassCard glow className="relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-[60px]" />
        <div className="relative flex items-center justify-center gap-3 text-center">
          <Trophy className="size-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">186,000+ km</span> run together since January 2026
          </p>
        </div>
      </GlassCard>

      {/* ─── TOAST ─── */}
      <div
        className={cn(
          "fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-primary/30 bg-background/95 px-5 py-3 shadow-lg backdrop-blur transition-all duration-300",
          joined ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium">Joined Stellar Marathon Club!</span>
        </div>
      </div>
    </MobileContainer>
  );
}
