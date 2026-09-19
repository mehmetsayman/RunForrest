"use client";

/**
 * Yarışma listesi ve oluşturma — ZİNCİR kaynaklı.
 *
 * Tek kaynak `runforrest_challenge` kontratı. Yarışmayı veritabanında da tutmak
 * cazip görünüyor ama iki ayrı gerçeklik yaratır: biri para tahsil eden
 * kontrat, biri `entry_fee` sütunu olup hiçbir şey tahsil etmeyen tablo.
 * O yüzden yarışmanın kendisi yalnızca zincirde; Supabase kozmetik üstveriyi
 * tutuyor (başlık, açıklama, konum) — GPS poligonunda yapılan ayrımın aynısı:
 * para ve itibar zincirde, süs veritabanında. Supabase yapılandırılmamışsa
 * yarışmalar "Yarışma #N" olarak görünür ve hiçbir şey kırılmaz.
 */

import { useCallback, useEffect, useState } from "react";
import { challenges as onchain, fromStroops } from "@/lib/stellar/contracts";
import type { Challenge as ChainChallenge } from "@/lib/stellar/contracts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Zincirdeki yarışma + (varsa) veritabanındaki üstveri. */
export type ChallengeView = {
  id: number;
  chain: ChainChallenge;
  title: string;
  description: string | null;
  location: string | null;
  level: string;
  /** Gösterim için: "10" gibi. */
  entryFeeUsdc: string;
  poolUsdc: string;
  participants: number;
  isOpen: boolean;
  /** Bu cüzdan katıldı mı? */
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
    /* üstveri kozmetik — kaydedilemezse yarışma yine de zincirde var */
  }
}

export type CreateChallengeInput = {
  title: string;
  description?: string;
  location?: string;
  level?: string;
  /** USDC, ondalıklı: "10" */
  entryFeeUsdc: string;
  /** Hedef mesafe, kilometre. */
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
            title: m?.title ?? `Yarışma #${id}`,
            description: m?.description ?? null,
            location: m?.location ?? null,
            level: m?.level ?? "Herkes",
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

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  /**
   * Yarışmayı ZİNCİRDE oluşturur, sonra üstveriyi kaydeder.
   * Sıra önemli: zincir kaynaktır, üstveri ona bağlanır.
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

  /** Katılım ücretini zincirde öder ve vault'a yatırır. */
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
