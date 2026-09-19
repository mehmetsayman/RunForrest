"use client";

/**
 * Şehir rozetleri — zincirden.
 *
 * `runforrest_badge` kontratından okunuyor: hangi şehirde kaç koşu, hangi kademe.
 */

import { useCallback, useEffect, useState } from "react";
import { badges, type Badge, type BadgeTier } from "@/lib/stellar/contracts";

/** Kademe → görsel dil. Orijinal RunForrest'ın nadirlik tablosu korundu. */
export const TIER_META: Record<
  BadgeTier,
  { label: string; roman: string; rarity: string; gradient: string; text: string }
> = {
  Common: {
    label: "Common",
    roman: "I",
    rarity: "1–5 koşu",
    gradient: "from-white/10 to-white/5",
    text: "text-[#a0a0a0]",
  },
  Rare: {
    label: "Rare",
    roman: "II",
    rarity: "6–15 koşu",
    gradient: "from-[#00c2d7]/25 to-[#05a2c2]/15",
    text: "text-[#00c2d7]",
  },
  Epic: {
    label: "Epic",
    roman: "III",
    rarity: "16–25 koşu",
    gradient: "from-[#9e8cfc]/25 to-[#6e56cf]/15",
    text: "text-[#9e8cfc]",
  },
  // En üst kademe marka rengini alıyor — altın, kazanılması en zor olan.
  Legendary: {
    label: "Legendary",
    roman: "IV",
    rarity: "26+ koşu",
    gradient: "from-[#fdda24]/30 to-[#ffb224]/20",
    text: "text-[#fdda24]",
  },
};

export function useBadges(address: string | null) {
  const [collection, setCollection] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) {
      setCollection([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setCollection(await badges.collection(address));
    } catch (e) {
      setError((e as Error).message);
      setCollection([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRuns = collection.reduce((s, b) => s + b.runs, 0);
  const totalDistanceM = collection.reduce(
    (s, b) => s + Number(b.total_distance_m),
    0,
  );

  return {
    collection,
    loading,
    error,
    reload: load,
    cities: collection.length,
    totalRuns,
    totalDistanceM,
    totalKm: (totalDistanceM / 1000).toFixed(1),
  };
}
