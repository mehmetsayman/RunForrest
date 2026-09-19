"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Plus,
  Route,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { PageHeader } from "@/components/runforrest/page-header";
import { NeonButton } from "@/components/runforrest/neon-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useChallenges } from "@/hooks/use-challenges";
import { useWallet } from "@/hooks/use-wallet";

/* ─── MOCK DATA ─── */

const paceFilters = ["All", "Beginner", "Intermediate", "Advanced"] as const;
type PaceFilter = (typeof paceFilters)[number];

const nearbyRunners = [
  { name: "elif_runs", distance: "0.3 km", pace: "5:40", level: "Intermediate", streak: 12, online: true, km: 186 },
  { name: "can_sprint", distance: "0.5 km", pace: "4:20", level: "Advanced", streak: 24, online: true, km: 410 },
  { name: "deniz_jog", distance: "0.8 km", pace: "6:30", level: "Beginner", streak: 4, online: true, km: 42 },
  { name: "mert_pace", distance: "1.2 km", pace: "5:10", level: "Intermediate", streak: 18, online: false, km: 220 },
  { name: "ayse_trail", distance: "1.5 km", pace: "4:55", level: "Advanced", streak: 30, online: true, km: 520 },
  { name: "ozan_flow", distance: "2.1 km", pace: "6:10", level: "Beginner", streak: 7, online: false, km: 68 },
];

const clubs = [
  {
    name: "Istanbul Sunrise Runners",
    members: 248,
    nextRun: "Sat 6:30 AM",
    location: "Maçka Park",
    distance: "0.8 km away",
    level: "All Levels",
    avatar: "IS",
    description: "Morning social runs along the Bosphorus. All paces welcome.",
    weeklyKm: "1.2k",
  },
  {
    name: "Kadıköy Night Pace",
    members: 92,
    nextRun: "Fri 8:00 PM",
    location: "Moda Coast",
    distance: "2.1 km away",
    level: "Intermediate",
    avatar: "KN",
    description: "Friday night tempo runs with post-run coffee.",
    weeklyKm: "480",
  },
  {
    name: "Stellar Marathon Club",
    members: 1204,
    nextRun: "Sun 7:00 AM",
    location: "Bosphorus Bridge",
    distance: "4.5 km away",
    level: "Advanced",
    avatar: "MM",
    description: "Serious distance runners. Long runs every Sunday.",
    weeklyKm: "8.4k",
  },
  {
    name: "Çanakkale Trail Crew",
    members: 56,
    nextRun: "Sat 5:30 AM",
    location: "Waterfront",
    distance: "New city",
    level: "All Levels",
    avatar: "CT",
    description: "Explore Çanakkale's coastline with fellow runners.",
    weeklyKm: "320",
  },
];

const events = [
  {
    title: "5K Social Run",
    date: "May 18, Sun",
    time: "7:00 AM",
    location: "Maçka Park, Istanbul",
    level: "All Levels",
    spots: 12,
    total: 30,
    host: "Istanbul Sunrise Runners",
    reward: "Participation NFT",
  },
  {
    title: "Tempo Tuesday",
    date: "May 20, Tue",
    time: "6:30 PM",
    location: "Moda Coast, Kadıköy",
    level: "Intermediate",
    spots: 8,
    total: 20,
    host: "Kadıköy Night Pace",
    reward: "Speed Badge",
  },
  {
    title: "Weekend Long Run",
    date: "May 24, Sat",
    time: "6:00 AM",
    location: "Bosphorus Bridge",
    level: "Advanced",
    spots: 24,
    total: 50,
    host: "Stellar Marathon Club",
    reward: "Distance NFT",
  },
  {
    title: "Beginner Friendly 3K",
    date: "May 25, Sun",
    time: "8:00 AM",
    location: "Bebek Park",
    level: "Beginner",
    spots: 18,
    total: 25,
    host: "Istanbul Sunrise Runners",
    reward: "First Steps NFT",
  },
];

const cityGroups = [
  { city: "Istanbul", members: 1840, active: 124, flag: "🇹🇷" },
  { city: "Singapore", members: 620, active: 48, flag: "🇸🇬" },
  { city: "London", members: 540, active: 36, flag: "🇬🇧" },
  { city: "Berlin", members: 380, active: 28, flag: "🇩🇪" },
  { city: "Tokyo", members: 290, active: 22, flag: "🇯🇵" },
];

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-emerald-500/20 text-emerald-300",
    Intermediate: "bg-blue-500/20 text-blue-300",
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

export default function CommunityPage() {
  const [activeFilter, setActiveFilter] = useState<PaceFilter>("All");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const { address, isConnected } = useWallet();
  const { challenges, createChallenge, joinChallenge } = useChallenges(address);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    entryFeeUsdc: "10",
    targetValue: "50",
    location: "",
    level: "Herkes",
    startDate: "",
    endDate: "",
  });

  async function handleCreateChallenge() {
    if (!form.title || !form.startDate || !form.endDate || !address) return;
    setCreating(true);
    setFormError(null);
    try {
      // Yarışma ZİNCİRDE oluşturulur; cüzdan işlemi imzalar.
      await createChallenge(address, {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        level: form.level,
        entryFeeUsdc: form.entryFeeUsdc || "10",
        targetKm: parseFloat(form.targetValue) || 50,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setShowCreateForm(false);
      setForm({ title: "", description: "", entryFeeUsdc: "10", targetValue: "50", location: "", level: "Herkes", startDate: "", endDate: "" });
    } catch (e) {
      setFormError((e as Error).message);
    }
    setCreating(false);
  }

  async function handleJoin(challengeId: number) {
    if (!address) return;
    setJoiningId(challengeId);
    setFormError(null);
    try {
      // Katılım ücreti zincirde ödenir ve vault'a yatar.
      await joinChallenge(challengeId, address);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setJoiningId(null);
    }
  }

  const filteredRunners = nearbyRunners.filter((r) => {
    if (activeFilter !== "All" && r.level !== activeFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <MobileContainer withNav className="space-y-5 pt-6 pb-6">
      {/* ─── HEADER ─── */}
      <PageHeader
        title="Community"
        subtitle="Runners, crews & events near you"
        action={
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary neon-glow-sm transition-transform active:scale-95"
            aria-label="Create event"
          >
            <Plus className={cn("size-5 transition-transform", showCreateForm && "rotate-45")} />
          </button>
        }
      />

      {/* ─── NEARBY PULSE ─── */}
      <GlassCard strong glow className="relative overflow-hidden p-5">
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-primary/15 blur-[50px]" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/20">
              <MapPin className="size-7 text-primary" />
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-2xl border border-primary/30 animate-ping" style={{ animationDuration: "2s" }} />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">
              <span className="text-gradient-stellar">24</span> runners nearby
            </p>
            <p className="text-xs text-muted-foreground">Istanbul · 6 active right now</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex -space-x-1.5">
              {nearbyRunners.slice(0, 4).map((r) => (
                <div
                  key={r.name}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-black bg-primary/30 text-[7px] font-bold"
                >
                  {r.name.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="mt-1 text-[9px] text-muted-foreground">+20</span>
          </div>
        </div>
      </GlassCard>

      {/* ─── SEARCH & FILTERS ─── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search runners, clubs, events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {paceFilters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                activeFilter === f
                  ? "bg-primary text-primary-foreground neon-glow-sm"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ─── NEARBY RUNNERS ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Zap className="size-4 text-primary" />
            Nearby Runners
          </h2>
          <span className="text-[10px] text-muted-foreground">{filteredRunners.length} found</span>
        </div>
        <div className="space-y-2">
          {filteredRunners.map((runner) => (
            <GlassCard
              key={runner.name}
              className="p-3.5 transition-all hover:border-primary/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 to-[#ffb224]/30 text-xs font-bold text-primary">
                      {runner.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {runner.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-black bg-emerald-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{runner.name}</p>
                    <LevelBadge level={runner.level} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="size-2.5" />
                      {runner.distance}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="size-2.5" />
                      {runner.pace}/km
                    </span>
                    <span>·</span>
                    <span>{runner.km} km</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors hover:bg-primary/25"
                >
                  <MessageCircle className="size-3.5" />
                </button>
              </div>
            </GlassCard>
          ))}
          {filteredRunners.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No runners found for this filter.
            </div>
          )}
        </div>
      </section>

      {/* ─── RUNNING CLUBS ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            Running Clubs
          </h2>
          <Link href="#" className="flex items-center text-xs text-primary">
            See all <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="space-y-2.5">
          {clubs.map((club) => {
            const isFeaturedClub = club.name === "Stellar Marathon Club";
            const card = (
              <GlassCard
                key={club.name}
                className={cn(
                  "overflow-hidden transition-all hover:border-primary/20",
                  isFeaturedClub && "cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-[#ffb224]/25 text-sm font-bold text-primary">
                      {club.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{club.name}</h3>
                        {isFeaturedClub && <ChevronRight className="size-3.5 text-primary" />}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {club.description}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="size-2.5" />
                          {club.members}
                        </span>
                        <span className="flex items-center gap-1">
                          <Route className="size-2.5" />
                          {club.weeklyKm} km/wk
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-2.5" />
                          {club.distance}
                        </span>
                      </div>
                    </div>
                    <LevelBadge level={club.level} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="size-3.5 text-primary" />
                    <span className="text-muted-foreground">
                      {club.nextRun} · {club.location}
                    </span>
                  </div>
                  <Badge className="border-0 bg-primary/20 text-[10px] text-primary cursor-pointer hover:bg-primary/30 transition-colors">
                    Join
                  </Badge>
                </div>
              </GlassCard>
            );

            if (isFeaturedClub) {
              return (
                <Link key={club.name} href="/community/stellar-marathon-club" className="block">
                  {card}
                </Link>
              );
            }
            return card;
          })}
        </div>
      </section>

      {/* ─── CREATE CHALLENGE CTA / FORM ─── */}
      {!showCreateForm ? (
        <div onClick={() => setShowCreateForm(true)} className="cursor-pointer">
        <GlassCard
          glow
          className="relative overflow-hidden p-5"
        >
          <div className="absolute -left-8 -bottom-8 size-32 rounded-full bg-primary/15 blur-[50px]" />
          <div className="relative flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-[#ffb224]/30 animate-pulse-glow">
              <Plus className="size-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Create Challenge / Event</p>
              <p className="text-xs text-muted-foreground">
                Organize a run, set a goal, earn Organizer NFT
              </p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </div>
        </GlassCard>
        </div>
      ) : (
        <GlassCard strong glow className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              New Challenge
            </h3>
            <button type="button" onClick={() => setShowCreateForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Yarışma adı *"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
            <textarea
              placeholder="Açıklama (opsiyonel)"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none resize-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="ml-1 text-[10px] text-muted-foreground">
                  Katılım ücreti (USDC) *
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.entryFeeUsdc}
                  onChange={(e) => setForm((p) => ({ ...p, entryFeeUsdc: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="ml-1 text-[10px] text-muted-foreground">Hedef (km)</label>
                <input
                  type="number"
                  value={form.targetValue}
                  onChange={(e) => setForm((p) => ({ ...p, targetValue: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Konum"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
              />
              <select
                value={form.level}
                onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm focus:border-primary/40 focus:outline-none"
              >
                <option value="Herkes">Herkes</option>
                <option value="Başlangıç">Başlangıç</option>
                <option value="Orta">Orta</option>
                <option value="İleri">İleri</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground ml-1">Başlangıç *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground ml-1">Bitiş *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>

            <p className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Yarışma zincirde oluşturulur. Katılan herkesin ücreti DeFindex
              vault&apos;una yatar; havuz bitişte ilk üçe 50/30/20 dağıtılır.
              Ödül kuralı kontratta sabittir — sonradan değiştirilemez.
            </p>

            {formError && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-[11px] text-red-400">
                {formError}
              </p>
            )}
          </div>

          <NeonButton
            className="w-full justify-center gap-2"
            onClick={handleCreateChallenge}
            disabled={creating || !form.title || !form.startDate || !form.endDate || !isConnected}
          >
            {creating ? (
              <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Zap className="size-4" />
            )}
            {!isConnected ? "Önce cüzdanı bağla" : creating ? "Zincire yazılıyor…" : "Yarışmayı oluştur"}
          </NeonButton>
        </GlassCard>
      )}

      {/* ─── TOPLULUK YARIŞMALARI (zincirden) ─── */}
      {challenges.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="size-4 text-primary" />
              Topluluk Yarışmaları
            </h2>
            <span className="text-[10px] text-muted-foreground">
              zincirden · {challenges.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {challenges.map((c) => (
              <GlassCard key={c.id} glow className="p-4 transition-all hover:border-primary/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{c.title}</h3>
                      <LevelBadge level={c.level} />
                    </div>
                    {c.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {c.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(Number(c.chain.start_time) * 1000).toLocaleDateString("tr-TR", { month: "short", day: "numeric" })}
                        {" — "}
                        {new Date(Number(c.chain.end_time) * 1000).toLocaleDateString("tr-TR", { month: "short", day: "numeric" })}
                      </span>
                      {c.chain.target_distance_m > 0 && (
                        <span className="flex items-center gap-1">
                          <Target className="size-3" />
                          {(c.chain.target_distance_m / 1000).toFixed(0)} km
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className="shrink-0 gap-0.5 border-0 bg-amber-500/20 text-[9px] text-amber-300">
                    <Sparkles className="size-2.5" />
                    {Number(c.poolUsdc).toFixed(2)} USDC havuz
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Users className="size-3" />
                    <span>
                      {c.participants} katılımcı · {Number(c.entryFeeUsdc).toFixed(0)} USDC giriş
                    </span>
                  </div>
                  {c.joined ? (
                    <Badge className="border-0 bg-emerald-500/20 text-[10px] text-emerald-400">
                      Katıldın
                    </Badge>
                  ) : !c.isOpen ? (
                    <Badge className="border-0 bg-white/10 text-[10px] text-muted-foreground">
                      Kapandı
                    </Badge>
                  ) : (
                    <NeonButton
                      className="h-7 px-4 text-xs"
                      onClick={() => handleJoin(c.id)}
                      disabled={!isConnected || joiningId === c.id}
                    >
                      {!isConnected
                        ? "Bağlan"
                        : joiningId === c.id
                          ? "İşleniyor…"
                          : "Katıl"}
                    </NeonButton>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* ─── UPCOMING EVENTS ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Calendar className="size-4 text-primary" />
            Upcoming Events
          </h2>
          <span className="text-[10px] text-muted-foreground">{events.length} events</span>
        </div>
        <div className="space-y-2.5">
          {events.map((event) => {
            const spotsPercent = ((event.total - event.spots) / event.total) * 100;
            return (
              <GlassCard key={event.title} className="p-4 transition-all hover:border-primary/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <LevelBadge level={event.level} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {event.date} · {event.time}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {event.location}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="border-0 bg-amber-500/20 text-[9px] text-amber-300 gap-0.5">
                      <Sparkles className="size-2.5" />
                      {event.reward}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {Array.from({ length: Math.min(4, event.total - event.spots) }).map((_, i) => (
                        <Avatar key={i} className="size-5 border border-black">
                          <AvatarFallback className="bg-primary/25 text-[6px]">
                            R{i + 1}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {event.spots} spots left
                    </span>
                  </div>
                  <NeonButton className="h-7 px-4 text-xs">
                    RSVP
                  </NeonButton>
                </div>

                {/* Spots bar */}
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-stellar-light transition-all"
                    style={{ width: `${spotsPercent}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>Hosted by {event.host}</span>
                  <span>{event.total - event.spots}/{event.total} joined</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* ─── CITY COMMUNITIES ─── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Globe className="size-4 text-primary" />
            City Communities
          </h2>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {cityGroups.map((city) => (
            <GlassCard
              key={city.city}
              className="min-w-[130px] shrink-0 p-4 text-center transition-all hover:border-primary/20 hover:scale-[1.02]"
            >
              <span className="text-2xl">{city.flag}</span>
              <p className="mt-2 font-semibold text-sm">{city.city}</p>
              <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Users className="size-2.5" />
                  {city.members.toLocaleString("en-US")}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400">{city.active} active</span>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ─── SOCIAL FOOTER ─── */}
      <GlassCard className="p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Heart className="size-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">3,240</span> community runs completed this month
          </p>
        </div>
      </GlassCard>
    </MobileContainer>
  );
}
