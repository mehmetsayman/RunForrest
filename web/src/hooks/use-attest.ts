"use client";

/**
 * Koşuyu zincire yazdırır.
 *
 * İmzayı attestor anahtarı atıyor ve o anahtar sunucuda; bu yüzden istemci
 * `/api/attest` üzerinden geçiyor. Zincire iki şey yazılabilir:
 *   - yarışma ilerlemesi (koşucu bir yarışmaya katıldıysa)
 *   - şehir rozeti (her koşuda)
 *
 * İkisi bağımsız: yarışmaya katılmamış biri de rozet kazanır.
 */

import { useCallback, useState } from "react";

export type AttestResult = {
  progress?: string;
  badge?: string;
  errors: string[];
};

export type AttestInput = {
  runner: string;
  distanceM: number;
  durationS: number;
  city?: string;
  challengeId?: number;
};

export function useAttest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attest = useCallback(
    async (input: AttestInput): Promise<AttestResult | null> => {
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetch("/api/attest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json()) as AttestResult & { error?: string };

        if (!res.ok) {
          setError(body.error ?? `Onaylama başarısız (HTTP ${res.status})`);
          return null;
        }
        setResult(body);
        return body;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { attest, busy, result, error, reset: () => setResult(null) };
}

/**
 * GPS noktasından şehir adı çıkarır (OpenStreetMap Nominatim).
 *
 * Başarısız olursa null döner — kullanıcı şehri elle yazabilir. Rozet şehir
 * adına göre verildiği için bu alan kullanıcı onayından geçiyor; sessizce
 * yanlış bir şehre rozet yazmıyoruz.
 */
export async function reverseGeocodeCity(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      address?: Record<string, string>;
    };
    const a = j.address ?? {};
    return (
      a.city ??
      a.town ??
      a.province ??
      a.state ??
      a.county ??
      a.village ??
      null
    );
  } catch {
    return null;
  }
}
