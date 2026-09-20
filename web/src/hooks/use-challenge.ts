"use client";

/**
 * Yarışma durumu ve katılım akışı.
 *
 * Leaderboard artık hardcoded bir diziden değil, kontrattan okunuyor:
 * katılımcı listesi (`get_roster`) + her birinin mesafesi (`get_participant`).
 *
 * Katılımın kritik yanı: koşucunun USDC'si yetmiyorsa akış kırılmıyor,
 * `needsFunding` true dönüyor ve arayüz TRY yükleme ekranını aynı yerde açıyor.
 * Ramp ayrı bir sayfa değil, katılımın içinde.
 */

import { useCallback, useEffect, useState } from "react";
import {
  challenges,
  fromStroops,
  usdcBalance,
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
   * Zaman, render sırasında okunamaz: Date.now() saf olmayan bir çağrı ve
   * yarışma sayfa açıkken bittiğinde arayüz bunu fark etmez. Dakikada bir
   * tikleyen bir state ile hem saflık korunuyor hem de bitiş anı yakalanıyor.
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
   * Mount'ta ve bağımlılık değiştiğinde zincirden veri çeker.
   *
   * Kural setState'i effect içinde görüp uyarıyor; buradaki senkron çağrı
   * yalnızca "yükleniyor" bayrağı, asıl veri await sonrası yazılıyor.
   * Dış bir sistemden (Soroban RPC) veri çekmek effect'in tam da amacı.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /**
   * Katılmayı dener. Ön koşullar sağlanmıyorsa hata fırlatmak yerine
   * arayüzün ne yapması gerektiğini söyleyen bir sonuç döner.
   */
  const join = useCallback(async (): Promise<JoinOutcome> => {
    if (!address) return { ok: false, error: "Önce cüzdanı bağlayın" };
    if (challengeId === null || !challenge)
      return { ok: false, error: "Yarışma yüklenmedi" };

    if (!hasTrustline) return { ok: false, needsTrustline: true };

    // Bakiye ZİNCİRDEN taze okunuyor, context'teki değerden değil.
    // Ramp bittiğinde katılıma devam ediliyor; o anda context henüz
    // tazelenmemiş olabiliyor ve kullanıcı parayı yatırdığı halde
    // "yeterli USDC yok" uyarısı alıp yükleme ekranına geri düşüyordu.
    const live = await usdcBalance(address);
    if (live < challenge.entry_fee) {
      return {
        ok: false,
        needsFunding: true,
        shortfall: fromStroops(challenge.entry_fee - live),
      };
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

  /** Bitiş zamanı geçtiyse herkes kapatabilir — kimse kilitli kalmasın. */
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

/** Açık olan en güncel yarışmayı bulur; yoksa en sonuncuyu döndürür. */
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
        // Sondan başa tara: açık olan ilk yarışma aktiftir.
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
