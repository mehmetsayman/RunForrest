"use client";

/**
 * Challenge state and the join flow.
 *
 * The leaderboard is read from the contract rather than a hardcoded array:
 * the roster (`get_roster`) plus each runner's distance (`get_participant`).
 *
 * The critical part of joining: if the runner is short on USDC the flow does
 * not break — `needsFunding` comes back true and the UI opens the fiat deposit
 * sheet in place. The ramp is not a separate page; it lives inside the join.
 */

import { useCallback, useEffect, useState } from "react";
import {
  challenges,
  fromStroops,
  usdcBalance,
  spendableXlm,
  MIN_XLM_FOR_FEES,
  type Challenge,
  type Participant,
} from "@/lib/stellar/contracts";
import { useWallet } from "@/components/wallet/wallet-provider";

export type LeaderRow = {
  address: string;
  distanceM: number;
  runs: number;
  payout: bigint;
  claimed: boolean;
  isYou: boolean;
};

export type JoinOutcome =
  | { ok: true; hash: string }
  | { ok: false; needsFunding: true; shortfall: string }
  | { ok: false; needsTrustline: true }
  | { ok: false; needsXlm: true; xlm: number }
  | { ok: false; error: string };

export function useChallenge(challengeId: number | null) {
  const { address, hasTrustline, refresh: refreshWallet } = useWallet();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);

  /**
   * Time cannot be read during render: Date.now() is impure, and a challenge
   * that ends while the page is open would go unnoticed. A state that ticks
   * keeps render pure and catches the moment the window closes.
   */
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (challengeId === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = await challenges.get(challengeId);
      setChallenge(c);

      const roster = await challenges.roster(challengeId);
      const rows = await Promise.all(
        roster.map(async (addr): Promise<LeaderRow> => {
          const p = await challenges.participant(challengeId, addr);
          return {
            address: addr,
            distanceM: p?.distance_m ?? 0,
            runs: p?.runs ?? 0,
            payout: p?.payout ?? 0n,
            claimed: p?.claimed ?? false,
            isYou: !!address && addr === address,
          };
        }),
      );
      rows.sort((a, b) => b.distanceM - a.distanceM);
      setLeaders(rows);
      setMe(rows.find((r) => r.isYou) ? await challenges.participant(challengeId, address!) : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, address]);

  /**
   * Fetches from chain on mount and whenever a dependency changes.
   *
   * The lint rule flags setState inside an effect; the synchronous call here is
   * only the "loading" flag — the real data is written after the await.
   * Fetching from an external system (Soroban RPC) is exactly what effects are for.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /**
   * Attempts to join. Rather than throwing when a precondition is unmet, it
   * returns a result telling the UI what to do next.
   */
  const join = useCallback(async (): Promise<JoinOutcome> => {
    if (!address) return { ok: false, error: "Connect your wallet first" };
    if (challengeId === null || !challenge)
      return { ok: false, error: "Challenge not loaded" };

    if (!hasTrustline) return { ok: false, needsTrustline: true };

    // The balance is read FRESH FROM CHAIN, not from the context value.
    // The join resumes right after the ramp, when the context may not have
    // refreshed yet — which sent the runner back to the deposit sheet with
    // the money already in their wallet.
    const live = await usdcBalance(address);
    if (live < challenge.entry_fee) {
      return {
        ok: false,
        needsFunding: true,
        shortfall: fromStroops(challenge.entry_fee - live),
      };
    }

    // The fee is paid in XLM, not USDC. An account funded only through the
    // anchor holds none, and the network then rejects the transaction before
    // the contract ever runs. Caught here, the UI can offer Friendbot instead
    // of showing a raw rejection. Spendable, not total: the minimum reserve is
    // locked away and cannot pay a fee.
    const xlm = await spendableXlm(address);
    if (xlm < MIN_XLM_FOR_FEES) {
      return { ok: false, needsXlm: true, xlm };
    }

    setBusy(true);
    setError(null);
    try {
      const { hash } = await challenges.join(challengeId, address);
      setLastHash(hash);
      await Promise.all([load(), refreshWallet()]);
      return { ok: true, hash };
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setBusy(false);
    }
  }, [address, challengeId, challenge, hasTrustline, load, refreshWallet]);

  const claim = useCallback(async () => {
    if (!address || challengeId === null) return null;
    setBusy(true);
    setError(null);
    try {
      const { hash } = await challenges.claim(challengeId, address);
      setLastHash(hash);
      await Promise.all([load(), refreshWallet()]);
      return hash;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [address, challengeId, load, refreshWallet]);

  /** Once the window closes anyone can finalize, so nobody stays locked in. */
  const finalize = useCallback(async () => {
    if (!address || challengeId === null) return null;
    setBusy(true);
    setError(null);
    try {
      const { hash } = await challenges.finalize(challengeId, address);
      setLastHash(hash);
      await load();
      return hash;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [address, challengeId, load]);

  const joined = !!me;
  const isOver = !!challenge && now >= Number(challenge.end_time);
  const isFinalized = challenge?.status === "Finalized";
  const canClaim = !!me && me.payout > 0n && !me.claimed && isFinalized;

  return {
    challenge,
    leaders,
    me,
    joined,
    isOver,
    isFinalized,
    canClaim,
    loading,
    busy,
    error,
    lastHash,
    join,
    claim,
    finalize,
    reload: load,
  };
}

/** Finds the most recent open challenge; falls back to the last one. */
export function useActiveChallengeId() {
  const [id, setId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const n = await challenges.count();
        if (n === 0) {
          if (alive) setId(null);
          return;
        }
        // Scan backwards: the first open challenge is the active one.
        for (let i = n - 1; i >= 0; i--) {
          const c = await challenges.get(i);
          const open =
            c.status === "Open" && Date.now() / 1000 < Number(c.end_time);
          if (open) {
            if (alive) setId(i);
            return;
          }
        }
        if (alive) setId(n - 1);
      } catch {
        if (alive) setId(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { id, loading };
}
