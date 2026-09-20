"use client";

/**
 * Challenge list and creation — sourced from CHAIN.
 *
 * The `runforrest_challenge` contract is the only source. Mirroring challenges
 * into a database is tempting but creates two realities: a contract that
 * collects money, and a table with an `entry_fee` column that collects nothing.
 * So the challenge itself lives only on chain and Supabase holds cosmetic
 * metadata (title, description, location) — the same split as the GPS route:
 * money and reputation on chain, decoration in the database. Without Supabase
 * challenges simply show as "Challenge #N" and nothing breaks.
 */

import { useCallback, useEffect, useState } from "react";
import { challenges as onchain, fromStroops } from "@/lib/stellar/contracts";
import type { Challenge as ChainChallenge } from "@/lib/stellar/contracts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** The on-chain challenge plus its database metadata, when present. */
export type ChallengeView = {
  id: number;
  chain: ChainChallenge;
  title: string;
  description: string | null;
  location: string | null;
  level: string;
  /** For display, e.g. "10". */
  entryFeeUsdc: string;
  poolUsdc: string;
  participants: number;
  isOpen: boolean;
  /** Has this wallet joined? */
  joined: boolean;
};

type Meta = {
  challenge_id: number;
  title: string | null;
  description: string | null;
  location: string | null;
  level: string | null;
};

async function loadMeta(): Promise<Map<number, Meta>> {
  if (!isSupabaseConfigured) return new Map();
  try {
    const { data, error } = await supabase.from("challenge_meta").select("*");
    if (error || !data) return new Map();
    return new Map((data as Meta[]).map((m) => [m.challenge_id, m]));
  } catch {
    return new Map();
  }
}

async function saveMeta(m: Meta): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("challenge_meta").upsert(m);
  } catch {
    /* metadata is cosmetic — if it fails to save, the challenge still exists on chain */
  }
}

export type CreateChallengeInput = {
  title: string;
  description?: string;
  location?: string;
  level?: string;
  /** USDC with decimals, e.g. "10" */
  entryFeeUsdc: string;
  /** Target distance, in kilometres. */
  targetKm: number;
  startDate: string;
  endDate: string;
};

export function useChallenges(viewer?: string | null) {
  const [challenges, setChallenges] = useState<ChallengeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, meta] = await Promise.all([
        onchain.listAll(viewer ?? undefined),
        loadMeta(),
      ]);

      const now = Date.now() / 1000;
      setChallenges(
        list.map(({ id, challenge, mine }) => {
          const m = meta.get(id);
          return {
            id,
            chain: challenge,
            title: m?.title ?? `Challenge #${id}`,
            description: m?.description ?? null,
            location: m?.location ?? null,
            level: m?.level ?? "All levels",
            entryFeeUsdc: fromStroops(challenge.entry_fee),
            poolUsdc: fromStroops(
              challenge.status === "Finalized"
                ? challenge.payout_pool
                : challenge.pool,
            ),
            participants: challenge.participants,
            isOpen:
              challenge.status === "Open" && now < Number(challenge.end_time),
            joined: !!mine,
          };
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [viewer]);

  /**
   * Fetches from chain on mount and whenever a dependency changes.
   *
   * The lint rule flags setState inside an effect; the synchronous call here is
   * only the "loading" flag — the real data is written after the await.
   * Fetching from an external system (Soroban RPC) is exactly what effects are for.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchChallenges();
  }, [fetchChallenges]);

  /**
   * Creates the challenge ON CHAIN, then saves the metadata.
   * The order matters: the chain is the source, metadata attaches to it.
   */
  const createChallenge = useCallback(
    async (creator: string, input: CreateChallengeInput) => {
      const start = Math.floor(new Date(input.startDate).getTime() / 1000);
      const end = Math.floor(new Date(input.endDate).getTime() / 1000);

      const { returnValue } = await onchain.create(creator, {
        entryFeeUsdc: input.entryFeeUsdc,
        startTime: start,
        endTime: end,
        targetDistanceM: Math.round(input.targetKm * 1000),
      });

      const id = Number(returnValue);
      if (Number.isFinite(id)) {
        await saveMeta({
          challenge_id: id,
          title: input.title || null,
          description: input.description ?? null,
          location: input.location ?? null,
          level: input.level ?? null,
        });
      }

      await fetchChallenges();
      return id;
    },
    [fetchChallenges],
  );

  /** Pays the entry fee on chain and deposits it into the vault. */
  const joinChallenge = useCallback(
    async (challengeId: number, runner: string) => {
      await onchain.join(challengeId, runner);
      await fetchChallenges();
    },
    [fetchChallenges],
  );

  return {
    challenges,
    loading,
    error,
    createChallenge,
    joinChallenge,
    refresh: fetchChallenges,
  };
}
