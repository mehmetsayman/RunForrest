"use client";

/**
 * Leaderboard — entirely on-chain.
 *
 * Participants come from `get_roster`, distances from `get_participant`, and
 * the pool from the real balance held in the DeFindex vault. Not a single
 * number on this page comes from the app's own records.
 *
 * If a runner lacks USDC at the moment of joining, the flow does not break:
 * the fiat deposit sheet opens in place and the join resumes once funds land.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  Clock,
  DollarSign,
  Gift,
  Loader2,
  Medal,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { MobileContainer } from "@/components/layout/mobile-container";
import { GlassCard } from "@/components/runforrest/glass-card";
import { NeonButton } from "@/components/runforrest/neon-button";
import { PageHeader } from "@/components/runforrest/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { ConnectButton } from "@/components/wallet/connect-button";
import { OnRampSheet } from "@/components/anchor/onramp-sheet";
import { OffRampSheet } from "@/components/anchor/offramp-sheet";
import { useWallet, truncate } from "@/components/wallet/wallet-provider";
import { useActiveChallengeId, useChallenge } from "@/hooks/use-challenge";
import { fromStroops, fundTestnetAccount } from "@/lib/stellar/contracts";
import { explorerContract, explorerTx, RUNFORREST_VAULT_ID } from "@/lib/stellar/config";
import { cn } from "@/lib/utils";

/* ─── helpers ─── */

const km = (meters: number) => (meters / 1000).toFixed(2);

function useCountdown(endTime?: bigint) {
  const [left, setLeft] = useState("—");
  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const s = Number(endTime) - Math.floor(Date.now() / 1000);
      if (s <= 0) return setLeft("ended");
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      setLeft(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, [endTime]);
  return left;
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20">
        <Trophy className="size-3.5 text-amber-400" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex size-7 items-center justify-center rounded-lg bg-slate-400/20">
        <Medal className="size-3.5 text-slate-300" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex size-7 items-center justify-center rounded-lg bg-orange-600/20">
        <Medal className="size-3.5 text-orange-400" />
      </div>
    );
  return (
    <div className="flex size-7 items-center justify-center rounded-lg bg-white/[0.04]">
      <span className="text-[11px] font-semibold text-muted-foreground">{rank}</span>
    </div>
  );
}

/** The contract's split: 50/30/20 for 3+ winners, 60/40 for two, 100% for one. */
function splitFor(winners: number): number[] {
  if (winners <= 0) return [];
  if (winners === 1) return [100];
  if (winners === 2) return [60, 40];
  return [50, 30, 20];
}

/* ─── page ─── */

export default function LeaderboardPage() {
  const { isConnected, address, refresh } = useWallet();
  const { id, loading: idLoading } = useActiveChallengeId();
  const c = useChallenge(id);

  const [showRewards, setShowRewards] = useState(false);
  const [rampOpen, setRampOpen] = useState(false);
  const [needed, setNeeded] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  /** Set when the wallet holds USDC but no XLM to pay the network fee. */
  const [lowXlm, setLowXlm] = useState<number | null>(null);
  const [fundingXlm, setFundingXlm] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);

  const countdown = useCountdown(c.challenge?.end_time);

  const handleJoin = useCallback(async () => {
    setNotice(null);
    setLowXlm(null);
    const res = await c.join();
    if (res.ok) return;

    if ("needsXlm" in res) {
      setLowXlm(res.xlm);
      return;
    }

    if ("needsTrustline" in res) {
      setNeeded(undefined);
      setRampOpen(true); // the deposit sheet covers the trustline step too
      return;
    }
    if ("needsFunding" in res) {
      setNeeded(res.shortfall);
      setRampOpen(true);
      return;
    }
    setNotice(res.error);
  }, [c]);

  /* ─── loading / no challenge ─── */

  if (idLoading || c.loading) {
    return (
      <MobileContainer withNav className="space-y-5 pb-6 pt-6">
        <PageHeader title="Leaderboard" subtitle="Loading…" />
        <GlassCard className="flex items-center justify-center p-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </GlassCard>
      </MobileContainer>
    );
  }

  if (id === null || !c.challenge) {
    return (
      <MobileContainer withNav className="space-y-5 pb-6 pt-6">
        <PageHeader title="Leaderboard" subtitle="No active challenge" />
        <GlassCard className="p-6 text-center">
          <Trophy className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm">No challenge is open right now.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can start one from the Community tab.
          </p>
        </GlassCard>
      </MobileContainer>
    );
  }

  const ch = c.challenge;
  const poolUsdc = fromStroops(ch.status === "Finalized" ? ch.payout_pool : ch.pool);
  const entryUsdc = fromStroops(ch.entry_fee);
  const winners = Math.min(3, c.leaders.filter((l) => l.distanceM > 0).length);
  const rewards = splitFor(winners).map((pct, i) => ({
    place: i + 1,
    pct,
    amount: (Number(poolUsdc) * pct) / 100,
  }));
  const maxM = Math.max(1, ...c.leaders.map((l) => l.distanceM));

  return (
    <MobileContainer withNav className="space-y-5 pb-6 pt-6">
      <PageHeader
        title="Leaderboard"
        subtitle={`Challenge #${id} · Stellar Testnet`}
        action={
          <Badge
            className={cn(
              "gap-1 border-0 text-[10px]",
              c.isFinalized
                ? "bg-white/10 text-muted-foreground"
                : "animate-pulse bg-red-500/20 text-red-400",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                c.isFinalized ? "bg-muted-foreground" : "bg-red-400",
              )}
            />
            {c.isFinalized ? "ENDED" : "LIVE"}
          </Badge>
        }
      />

      {/* ─── PRIZE POOL ─── */}
      <GlassCard strong glow className="relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-[60px]" />
        <div className="absolute -bottom-10 -left-10 size-32 rounded-full bg-amber-500/10 blur-[50px]" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Prize Pool
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-gradient text-3xl font-bold">
                  {Number(poolUsdc).toFixed(2)}
                </span>
                <span className="text-sm font-medium text-primary">USDC</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {ch.participants} runners · {Number(entryUsdc).toFixed(0)} USDC entry
              </p>
            </div>
            <ProgressRing
              value={Math.min(100, (c.leaders.length / Math.max(1, ch.participants)) * 100)}
              max={100}
              size={72}
              strokeWidth={5}
              icon={<DollarSign className="size-4 text-primary" />}
              label={`${ch.participants}`}
            />
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {c.isFinalized ? "Challenge closed" : `Time left: ${countdown}`}
            </span>
          </div>

          {/* Where the pool actually sits — a verifiable link, not a claim */}
          <a
            href={explorerContract(RUNFORREST_VAULT_ID)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
          >
            <Wallet className="size-3" />
            The pool is held in a DeFindex vault ↗
          </a>
        </div>
      </GlassCard>

      {/* ─── EYLEMLER ─── */}
      <div className="grid grid-cols-2 gap-2">
        {!isConnected ? (
          <ConnectButton variant="default" className="justify-center" />
        ) : c.canClaim ? (
          <NeonButton
            className="animate-pulse-glow justify-center gap-2"
            onClick={() => c.claim()}
            disabled={c.busy}
          >
            {c.busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            {fromStroops(c.me?.payout ?? 0n)} USDC al
          </NeonButton>
        ) : c.joined ? (
          <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-400">
            <Check className="size-4" />
            Joined
          </div>
        ) : c.isOver ? (
          <button
            type="button"
            onClick={() => c.finalize()}
            disabled={c.busy || c.isFinalized}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-40"
          >
            {c.busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            Close challenge
          </button>
        ) : (
          <NeonButton
            className="animate-pulse-glow justify-center gap-2"
            onClick={handleJoin}
            disabled={c.busy}
          >
            {c.busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {c.busy ? "Processing…" : `Join · ${Number(entryUsdc).toFixed(0)} USDC`}
          </NeonButton>
        )}

        <button
          type="button"
          onClick={() => setShowRewards(!showRewards)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition-all hover:border-primary/20 hover:bg-white/10"
        >
          <Gift className="size-4 text-primary" />
          Rewards
        </button>
      </div>

      {/* Winnings claimed: the natural moment to cash out */}
      {c.me?.claimed && c.me.payout > 0n && (
        <GlassCard glow className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <Banknote className="size-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                You won {fromStroops(c.me.payout)} USDC
              </p>
              <p className="text-[11px] text-muted-foreground">
                Withdraw it to your bank account in Turkish Lira
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCashOutOpen(true)}
              className="shrink-0 rounded-xl bg-primary/15 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
            >
              Withdraw to IBAN
            </button>
          </div>
        </GlassCard>
      )}

      {/* transaction / error notice */}
      {c.lastHash && (
        <GlassCard className="p-3">
          <div className="flex items-center gap-2">
            <Check className="size-3.5 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Transaction confirmed</p>
              <a
                href={explorerTx(c.lastHash)}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-mono text-[10px] text-primary hover:underline"
              >
                {c.lastHash}
              </a>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Enough USDC, no XLM for the fee. Separated from the error notice
          because it is not a dead end: on testnet Friendbot fixes it in one tap. */}
      {lowXlm !== null && (
        <GlassCard className="border-amber-500/20 p-4">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-amber-300">
                Not enough XLM for the network fee
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Your wallet has {lowXlm.toFixed(4)} XLM free to spend. A contract
                call costs around 0.2 XLM, paid separately from the entry fee —
                and Stellar locks 1.5 XLM away as the account reserve.
              </p>
              <button
                type="button"
                disabled={fundingXlm || !address}
                onClick={async () => {
                  if (!address) return;
                  setFundingXlm(true);
                  try {
                    await fundTestnetAccount(address);
                    setLowXlm(null);
                    await refresh();
                    await handleJoin();
                  } catch (e) {
                    setNotice((e as Error).message);
                  } finally {
                    setFundingXlm(false);
                  }
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
              >
                {fundingXlm ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Requesting…
                  </>
                ) : (
                  "Get testnet XLM"
                )}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {(notice || c.error) && (
        <GlassCard className="border-red-500/20 p-3">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
            <p className="text-xs text-red-400">{notice ?? c.error}</p>
          </div>
        </GlassCard>
      )}

      {/* ─── PRIZE SPLIT ─── */}
      {showRewards && (
        <div className="space-y-2">
          {rewards.length === 0 ? (
            <GlassCard className="p-4">
              <p className="text-xs text-muted-foreground">
                No runs recorded yet — the split is decided once the first run lands.
              </p>
            </GlassCard>
          ) : (
            rewards.map((r) => (
              <GlassCard key={r.place} className="flex items-center gap-3 p-3">
                <RankDisplay rank={r.place} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Place {r.place}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.pct}% of the pool
                  </p>
                </div>
                <span className="font-semibold text-primary">
                  {r.amount.toFixed(2)} USDC
                </span>
              </GlassCard>
            ))
          )}
          <p className="px-1 text-[10px] text-muted-foreground">
            The split is fixed in the contract; any rounding remainder goes to the last winner.
          </p>
        </div>
      )}

      {/* ─── SIRALAMA ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">Runners</h2>
          <span className="text-[10px] text-muted-foreground">
            read from chain
          </span>
        </div>

        {c.leaders.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm">Nobody has joined yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first — start the pool yourself.
            </p>
          </GlassCard>
        ) : (
          c.leaders.map((l, i) => (
            <GlassCard
              key={l.address}
              className={cn(
                "flex items-center gap-3 p-3",
                l.isYou && "border-primary/30 bg-primary/[0.06]",
              )}
            >
              <RankDisplay rank={i + 1} />
              <Avatar className="size-8">
                <AvatarFallback className="bg-white/[0.06] text-[10px]">
                  {l.address.slice(1, 3)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-mono text-xs">{truncate(l.address)}</p>
                  {l.isYou && (
                    <Badge className="border-0 bg-primary/20 px-1.5 text-[9px] text-primary">
                      sen
                    </Badge>
                  )}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${(l.distanceM / maxM) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{km(l.distanceM)}</p>
                <p className="text-[10px] text-muted-foreground">
                  km · {l.runs} runs
                </p>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <OffRampSheet open={cashOutOpen} onClose={() => setCashOutOpen(false)} />

      {/* The fiat deposit sheet, opened at the moment of joining */}
      <OnRampSheet
        open={rampOpen}
        onClose={() => setRampOpen(false)}
        neededUsdc={needed}
        onFunded={() => {
          // Funds landed; resume the join where it left off.
          setRampOpen(false);
          handleJoin();
        }}
      />
    </MobileContainer>
  );
}
