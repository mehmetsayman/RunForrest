"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Award,
  Check,
  ChevronRight,
  Clock,
  FileUp,
  Flame,
  Globe,
  MapPin,
  Mountain,
  Navigation,
  Pause,
  Play,
  Route,
  Sparkles,
  Square,
  Timer,
  TrendingUp,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { PageHeader } from "@/components/runforrest/page-header";
import { NeonButton } from "@/components/runforrest/neon-button";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { RunMap } from "@/components/map/dynamic-map";
import { useGpsTracking } from "@/hooks/use-gps-tracking";
import { useSaveRun } from "@/hooks/use-save-run";
import { useAttest, reverseGeocodeCity } from "@/hooks/use-attest";
import { useActiveChallengeId } from "@/hooks/use-challenge";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";
import { parseGpx, type GpxRunData } from "@/lib/gpx-parser";

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return (meters / 1000).toFixed(2);
}

type Tab = "gps" | "upload";

export default function RunPage() {
  const [tab, setTab] = useState<Tab>("gps");
  const gps = useGpsTracking();
  const { address } = useWallet();
  const { loading: saving, success: saved, error: saveError, saveRun, reset: resetSave } = useSaveRun();

  /* ── GPX upload state ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxData, setGpxData] = useState<GpxRunData | null>(null);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [gpxParsing, setGpxParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const distanceKm = gps.stats.distance / 1000;

  /* ── zincire yazma ── */
  const attest = useAttest();
  const { id: activeChallengeId } = useActiveChallengeId();
  const [city, setCity] = useState("");
  const [cityGuessed, setCityGuessed] = useState(false);

  // Koşu bitince ilk GPS noktasından şehri tahmin et; kullanıcı onaylar/düzeltir.
  useEffect(() => {
    if (cityGuessed || gps.state !== "complete") return;
    const first = gps.stats.positions[0];
    if (!first) return;
    setCityGuessed(true);
    reverseGeocodeCity(first[0], first[1]).then((c) => {
      if (c) setCity((prev) => prev || c);
    });
  }, [gps.state, gps.stats.positions, cityGuessed]);

  /**
   * Koşuyu kaydeder: rota Supabase'e (varsa), mesafe ve rozet zincire.
   * Supabase yapılandırılmamışsa zincir yazımı yine de yapılır.
   */
  const commitRun = async (run: {
    distanceMeters: number;
    durationSeconds: number;
    pace: string;
    calories: number;
    avgSpeed: number;
    positions: [number, number][];
  }) => {
    if (isSupabaseConfigured) {
      await saveRun({ walletAddress: address ?? "anonymous", ...run });
    }
    if (address) {
      await attest.attest({
        runner: address,
        distanceM: run.distanceMeters,
        durationS: run.durationSeconds,
        city: city.trim() || undefined,
        challengeId: activeChallengeId ?? undefined,
      });
    }
  };

  const handleSaveAndSubmit = async () => {
    await commitRun({
      distanceMeters: gps.stats.distance,
      durationSeconds: gps.stats.duration,
      pace: gps.stats.pace,
      calories: gps.stats.calories,
      avgSpeed: gps.stats.avgSpeed,
      positions: gps.stats.positions,
    });
  };

  const processGpxFile = useCallback(async (file: File) => {
    setGpxFile(file);
    setGpxError(null);
    setGpxData(null);
    setGpxParsing(true);
    resetSave();

    try {
      const text = await file.text();
      const data = parseGpx(text);
      if (data.positions.length < 2) {
        throw new Error("GPX file must contain at least 2 track points.");
      }
      setGpxData(data);
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : "Failed to parse GPX file.");
    } finally {
      setGpxParsing(false);
    }
  }, [resetSave]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith(".gpx")) {
        processGpxFile(file);
      } else {
        setGpxError("Please upload a .gpx file.");
      }
    },
    [processGpxFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processGpxFile(file);
      e.target.value = "";
    },
    [processGpxFile]
  );

  const clearGpxUpload = useCallback(() => {
    setGpxFile(null);
    setGpxData(null);
    setGpxError(null);
    resetSave();
  }, [resetSave]);

  const handleGpxSaveAndSubmit = async () => {
    if (!gpxData) return;
    await commitRun({
      distanceMeters: gpxData.distanceMeters,
      durationSeconds: gpxData.durationSeconds,
      pace: gpxData.pace,
      calories: gpxData.calories,
      avgSpeed: gpxData.avgSpeed,
      positions: gpxData.positions,
    });
  };

  return (
    <MobileContainer withNav className="space-y-4 pt-6 pb-6">
      <PageHeader
        title={gps.state === "tracking" ? "Running..." : gps.state === "paused" ? "Paused" : gps.state === "complete" ? "Run Complete" : "Run"}
        subtitle={
          gps.state === "tracking"
            ? "GPS is tracking your route"
            : gps.state === "complete"
              ? "Review your run and submit"
              : "Start a live run or upload activity"
        }
        action={
          gps.state !== "idle" && gps.state !== "complete" ? (
            <Badge className="border-0 bg-red-500/20 text-red-400 text-[10px] gap-1 animate-pulse">
              <span className="size-1.5 rounded-full bg-red-400" />
              LIVE
            </Badge>
          ) : undefined
        }
      />

      {/* ─── MODE TABS (only in idle) ─── */}
      {gps.state === "idle" && (
        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {[
            { id: "gps" as Tab, label: "Live GPS", icon: Navigation },
            { id: "upload" as Tab, label: "Upload File", icon: Upload },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium transition-all",
                tab === t.id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ━━━━━━━━━━ IDLE — GPS TAB ━━━━━━━━━━ */}
      {gps.state === "idle" && tab === "gps" && (
        <div className="space-y-4">
          <GlassCard glow className="flex flex-col items-center p-8 text-center">
            <div className="relative">
              <div className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-primary/30 bg-primary/10 animate-pulse-glow">
                <Navigation className="size-12 text-primary" />
              </div>
              <div className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <MapPin className="size-4 text-white" />
              </div>
            </div>

            <h2 className="mt-6 text-xl font-bold font-heading">Start Running</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              We&apos;ll track your route with GPS, measure distance, pace, and calories in real-time
            </p>

            {gps.error && (
              <div className="mt-4 w-full rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-400">{gps.error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={gps.start}
              aria-label="Koşuyu başlat"
              className="mt-6 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#ffb224] text-[#161616] shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 neon-glow"
            >
              <Play className="size-8 ml-1" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">Tap to start</p>
          </GlassCard>

          {/* Tips */}
          <GlassCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tips</p>
            <div className="space-y-2.5">
              {[
                { icon: MapPin, text: "Allow location access for GPS tracking" },
                { icon: Zap, text: "Keep your phone unlocked during the run" },
                { icon: Globe, text: "Works best outdoors with clear sky" },
              ].map((tip) => (
                <div key={tip.text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <tip.icon className="size-3.5 shrink-0 text-primary" />
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ━━━━━━━━━━ IDLE — UPLOAD TAB ━━━━━━━━━━ */}
      {gps.state === "idle" && tab === "upload" && !gpxData && (
        <div className="space-y-4">
          {/* Drag & drop zone */}
          <GlassCard
            glow
            className={cn(
              "relative flex flex-col items-center p-8 text-center transition-all",
              dragOver && "ring-2 ring-primary/60 bg-primary/[0.06]"
            )}
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="relative">
              <div className={cn(
                "flex size-24 items-center justify-center rounded-3xl border-2 border-dashed bg-primary/10 transition-colors",
                dragOver ? "border-primary" : "border-primary/30"
              )}>
                {gpxParsing ? (
                  <div className="size-10 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
                ) : (
                  <FileUp className="size-10 text-primary" />
                )}
              </div>
              <div className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-primary neon-glow">
                <Zap className="size-4 text-white" />
              </div>
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              {gpxParsing ? "Parsing..." : dragOver ? "Drop your file" : "Import Your Run"}
            </h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {gpxParsing
                ? "Reading track points from GPX file"
                : "Drag & drop a GPX file here, or tap to browse"}
            </p>

            {gpxFile && !gpxParsing && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs">
                <FileUp className="size-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[180px]">{gpxFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearGpxUpload(); }}
                  className="relative z-20 ml-1 rounded p-0.5 hover:bg-white/10"
                >
                  <X className="size-3 text-muted-foreground" />
                </button>
              </div>
            )}

            <div className="mt-6 flex items-center gap-6">
              {[
                { label: "Strava", desc: "Export" },
                { label: "Garmin", desc: "Connect" },
                { label: "Nike", desc: "Run Club" },
              ].map((f) => (
                <div key={f.label} className="text-center">
                  <div className="flex size-10 mx-auto items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-primary">
                    {f.label.slice(0, 3).toUpperCase()}
                  </div>
                  <p className="mt-1 text-[9px] text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          {gpxError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
              <p className="text-xs text-red-400">{gpxError}</p>
            </div>
          )}

          <GlassCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">How to export GPX</p>
            <div className="space-y-2.5">
              {[
                { icon: Globe, text: "Strava — Open activity → ⋯ → Export GPX" },
                { icon: MapPin, text: "Garmin Connect → Activity → Export → GPX" },
                { icon: Activity, text: "Nike Run Club — Use third-party exporter" },
              ].map((tip) => (
                <div key={tip.text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <tip.icon className="size-3.5 shrink-0 text-primary" />
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ━━━━━━━━━━ GPX PREVIEW (parsed data) ━━━━━━━━━━ */}
      {gps.state === "idle" && tab === "upload" && gpxData && (
        <div className="space-y-4">
          {/* Route Map */}
          {gpxData.positions.length >= 2 && (
            <GlassCard strong glow className="overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <span className="text-sm font-semibold">Imported Route</span>
                </div>
                <Badge className="border-0 bg-primary/20 text-[10px] text-primary">
                  <FileUp className="mr-0.5 size-3" />
                  GPX
                </Badge>
              </div>
              <RunMap
                positions={gpxData.positions}
                height="h-48"
                followUser={false}
                showMarkers
                interactive
              />
            </GlassCard>
          )}

          {/* Main stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Route, label: "Distance", value: `${(gpxData.distanceMeters / 1000).toFixed(2)} km`, highlight: true },
              { icon: Clock, label: "Duration", value: formatDuration(gpxData.durationSeconds), highlight: false },
              { icon: TrendingUp, label: "Avg Pace", value: `${gpxData.pace}/km`, highlight: false },
            ].map((stat) => (
              <GlassCard key={stat.label} glow={stat.highlight} className="p-3 text-center">
                <stat.icon className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-lg font-bold tabular-nums">{stat.value}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              </GlassCard>
            ))}
          </div>

          {/* Extra stats */}
          <div className="grid grid-cols-3 gap-2">
            <GlassCard className="p-3 text-center">
              <Flame className="mx-auto size-3.5 text-primary" />
              <p className="mt-1 text-sm font-bold tabular-nums">{gpxData.calories}</p>
              <p className="text-[8px] uppercase text-muted-foreground">Calories</p>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <Activity className="mx-auto size-3.5 text-primary" />
              <p className="mt-1 text-sm font-bold tabular-nums">{gpxData.avgSpeed}</p>
              <p className="text-[8px] uppercase text-muted-foreground">Avg km/h</p>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <Mountain className="mx-auto size-3.5 text-primary" />
              <p className="mt-1 text-sm font-bold tabular-nums">{gpxData.elevationGain}m</p>
              <p className="text-[8px] uppercase text-muted-foreground">Elevation</p>
            </GlassCard>
          </div>

          {/* File info */}
          {gpxFile && (
            <GlassCard className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileUp className="size-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{gpxFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {gpxData.positions.length} track points
                      {gpxData.startTime && ` · ${new Date(gpxData.startTime).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearGpxUpload}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </GlassCard>
          )}

          {/* NFT Badge Eligible */}
          {gpxData.distanceMeters / 1000 >= 1 && (
            <GlassCard glow className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-[#ffb224]/30 animate-float-slow">
                  <MapPin className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">City Runner Badge</p>
                  <p className="text-xs text-muted-foreground">
                    NFT Badge Eligible · {(gpxData.distanceMeters / 1000).toFixed(1)} km run
                  </p>
                </div>
                <Badge className="border-0 bg-amber-500/20 text-amber-300 text-[10px]">
                  <Sparkles className="mr-0.5 size-3" />
                  New!
                </Badge>
              </div>
            </GlassCard>
          )}

          {/* Save & Submit */}
          {saved ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <Check className="mx-auto size-6 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-emerald-400">Run Saved!</p>
              <p className="text-xs text-muted-foreground mt-1">Your imported run is stored securely</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGpxSaveAndSubmit}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#ffb224] px-6 py-3.5 text-sm font-semibold text-[#161616] shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed neon-glow animate-pulse-glow"
            >
              {saving ? (
                <>
                  <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Kaydet ve Stellar'a yaz
                </>
              )}
            </button>
          )}

          {saveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
              <p className="text-xs text-red-400">{saveError}</p>
            </div>
          )}

          {saved && (
            <NeonButton className="w-full justify-center gap-2" size="lg" href="/mint">
              <Zap className="size-4" />
              Stellar'da doğrula
            </NeonButton>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            Activity hash will be stored onchain as proof of run
          </p>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <NeonButton href="/dashboard" className="justify-center gap-1.5">
              <ChevronRight className="size-4" />
              Dashboard
            </NeonButton>
            <button
              type="button"
              onClick={clearGpxUpload}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              <Upload className="size-4 text-primary" />
              New Upload
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━ TRACKING STATE ━━━━━━━━━━ */}
      {(gps.state === "tracking" || gps.state === "paused") && (
        <div className="space-y-4">
          {/* Live Map */}
          <div className="relative">
            <RunMap
              positions={gps.stats.positions}
              currentPosition={gps.stats.currentPosition}
              accuracy={gps.stats.accuracy}
              height="h-72"
              followUser={gps.state === "tracking"}
              showMarkers
              /* Koşu sırasında da gezilebilir: kullanıcı kaydırınca takip
                 durur, "Merkeze al" ile geri döner. */
              interactive
            />
            {/* GPS accuracy indicator */}
            <div className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 backdrop-blur">
              <span className={cn(
                "size-2 rounded-full",
                gps.state === "tracking" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              )} />
              <span className="text-[10px] font-medium">
                {gps.state === "tracking" ? "GPS aktif" : "Duraklatıldı"}
                {gps.stats.accuracy != null && (
                  <span className="ml-1 text-muted-foreground">
                    ±{Math.round(gps.stats.accuracy)}m
                  </span>
                )}
              </span>
            </div>
            {gps.stats.positions.length > 0 && (
              <div className="absolute right-3 top-3 z-[1000] rounded-lg bg-black/70 px-2.5 py-1.5 backdrop-blur">
                <span className="text-[10px] text-muted-foreground">
                  {gps.stats.positions.length} pts
                </span>
              </div>
            )}
          </div>

          {/* Live Stats */}
          <GlassCard strong glow className="p-5">
            {/* Main distance */}
            <div className="text-center mb-4">
              <p className="text-5xl font-bold font-heading tabular-nums text-gradient">
                {formatDistance(gps.stats.distance)}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                {gps.stats.distance >= 1000 ? "Kilometers" : "Meters"}
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/[0.04] p-3 text-center">
                <Timer className="mx-auto size-4 text-primary mb-1" />
                <p className="text-lg font-bold tabular-nums">
                  {formatDuration(gps.stats.duration)}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground">Duration</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3 text-center">
                <TrendingUp className="mx-auto size-4 text-primary mb-1" />
                <p className="text-lg font-bold tabular-nums">
                  {gps.stats.pace}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground">Pace /km</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3 text-center">
                <Flame className="mx-auto size-4 text-primary mb-1" />
                <p className="text-lg font-bold tabular-nums">
                  {gps.stats.calories}
                </p>
                <p className="text-[9px] uppercase text-muted-foreground">Calories</p>
              </div>
            </div>
          </GlassCard>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6">
            {gps.state === "tracking" ? (
              <>
                <button
                  type="button"
                  onClick={gps.pause}
                  aria-label="Duraklat"
                  className="flex size-16 items-center justify-center rounded-full border-2 border-white/10 bg-white/5 text-foreground transition-all hover:bg-white/10 active:scale-90"
                >
                  <Pause className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={gps.stop}
                  aria-label="Koşuyu bitir"
                  className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl shadow-red-500/30 transition-all hover:scale-105 active:scale-90"
                >
                  <Square className="size-8" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={gps.resume}
                  aria-label="Devam et"
                  className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#ffb224] text-[#161616] shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-90 neon-glow"
                >
                  <Play className="size-8 ml-1" />
                </button>
                <button
                  type="button"
                  onClick={gps.stop}
                  aria-label="Koşuyu bitir"
                  className="flex size-16 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:bg-red-500/20 active:scale-90"
                >
                  <Square className="size-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━ COMPLETE STATE ━━━━━━━━━━ */}
      {gps.state === "complete" && (
        <div className="space-y-4">
          {/* Route Map Summary */}
          {gps.stats.positions.length >= 2 && (
            <GlassCard strong glow className="overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <span className="text-sm font-semibold">Your Route</span>
                </div>
                <Badge className="border-0 bg-emerald-500/20 text-[10px] text-emerald-400">
                  <Check className="mr-0.5 size-3" />
                  GPS Verified
                </Badge>
              </div>
              <RunMap
                positions={gps.stats.positions}
                height="h-48"
                followUser={false}
                showMarkers
                interactive
              />
            </GlassCard>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Route, label: "Distance", value: `${distanceKm.toFixed(2)} km`, highlight: true },
              { icon: Clock, label: "Duration", value: formatDuration(gps.stats.duration), highlight: false },
              { icon: TrendingUp, label: "Avg Pace", value: `${gps.stats.pace}/km`, highlight: false },
            ].map((stat) => (
              <GlassCard
                key={stat.label}
                glow={stat.highlight}
                className="p-3 text-center"
              >
                <stat.icon className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-lg font-bold tabular-nums">{stat.value}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
              </GlassCard>
            ))}
          </div>

          {/* Extra stats */}
          <div className="grid grid-cols-3 gap-2">
            <GlassCard className="p-3 text-center">
              <Flame className="mx-auto size-3.5 text-primary" />
              <p className="mt-1 text-sm font-bold tabular-nums">{gps.stats.calories}</p>
              <p className="text-[8px] uppercase text-muted-foreground">Calories</p>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <Activity className="mx-auto size-3.5 text-primary" />
              <p className="mt-1 text-sm font-bold tabular-nums">{gps.stats.avgSpeed}</p>
              <p className="text-[8px] uppercase text-muted-foreground">Avg km/h</p>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <Navigation className="mx-auto size-3.5 text-primary" />
              <p className="mt-1 text-sm font-bold tabular-nums">{gps.stats.positions.length}</p>
              <p className="text-[8px] uppercase text-muted-foreground">GPS Points</p>
            </GlassCard>
          </div>

          {/* NFT Badge Eligible */}
          {distanceKm >= 1 && (
            <GlassCard glow className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-[#ffb224]/30 animate-float-slow">
                  <MapPin className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">City Runner Badge</p>
                  <p className="text-xs text-muted-foreground">
                    NFT Badge Eligible · {distanceKm.toFixed(1)} km run
                  </p>
                </div>
                <Badge className="border-0 bg-amber-500/20 text-amber-300 text-[10px]">
                  <Sparkles className="mr-0.5 size-3" />
                  New!
                </Badge>
              </div>
            </GlassCard>
          )}

          {/* Şehir — rozet buna göre veriliyor, o yüzden kullanıcı onaylıyor */}
          {!attest.result && (
            <GlassCard className="p-4">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Koştuğun şehir
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Örn. İstanbul"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Şehir rozeti bu isme yazılır. Konumdan tahmin edildi — yanlışsa düzelt.
              </p>
            </GlassCard>
          )}

          {/* Kaydet ve zincire yaz */}
          {attest.result ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <Check className="mx-auto mb-2 size-6 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Koşu kaydedildi</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Mesafen Stellar üzerinde doğrulanabilir
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSaveAndSubmit}
              disabled={saving || attest.busy || !address}
              className="neon-glow animate-pulse-glow flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#ffb224] px-6 py-3.5 text-sm font-semibold text-[#161616] shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving || attest.busy ? (
                <>
                  <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {attest.busy ? "Zincire yazılıyor…" : "Kaydediliyor…"}
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  {address ? "Kaydet ve Stellar'a yaz" : "Önce cüzdanı bağla"}
                </>
              )}
            </button>
          )}
          {/* Zincir durumu */}
          {attest.busy && (
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-center">
              <p className="text-xs text-primary">Koşu zincire yazılıyor…</p>
            </div>
          )}

          {attest.result && (
            <GlassCard className="space-y-2 p-4">
              <p className="text-sm font-semibold text-emerald-400">Zincire yazıldı</p>
              {attest.result.badge && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${attest.result.badge}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-mono text-[10px] text-primary hover:underline"
                >
                  rozet · {attest.result.badge.slice(0, 24)}… ↗
                </a>
              )}
              {attest.result.progress && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${attest.result.progress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-mono text-[10px] text-primary hover:underline"
                >
                  yarışma ilerlemesi · {attest.result.progress.slice(0, 24)}… ↗
                </a>
              )}
              {attest.result.errors.length > 0 && (
                <p className="text-[10px] text-amber-400">
                  {attest.result.errors.join(" · ")}
                </p>
              )}
            </GlassCard>
          )}

          {attest.error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
              <p className="text-xs text-red-400">{attest.error}</p>
            </div>
          )}


          {saveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
              <p className="text-xs text-red-400">{saveError}</p>
            </div>
          )}

          {attest.result?.badge && (
            <NeonButton className="w-full justify-center gap-2" size="lg" href="/mint">
              <Zap className="size-4" />
              Rozetini gör
            </NeonButton>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            Activity hash will be stored onchain as proof of run
          </p>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <NeonButton href="/dashboard" className="justify-center gap-1.5">
              <ChevronRight className="size-4" />
              Dashboard
            </NeonButton>
            <button
              type="button"
              onClick={gps.reset}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              <Play className="size-4 text-primary" />
              New Run
            </button>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}
