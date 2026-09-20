"use client";

/**
 * Writes a run to chain.
 *
 * The attestor key signs it and that key lives on the server, so the client
 * goes through `/api/attest`. Two things can be written:
 *   - challenge progress (if the runner joined a challenge)
 *   - a city badge (on every run)
 *
 * The two are independent: a runner who joined nothing still earns a badge.
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
          setError(body.error ?? `Attestation failed (HTTP ${res.status})`);
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
 * Derives a city name from a GPS point (OpenStreetMap Nominatim).
 *
 * Returns null on failure so the user can type the city themselves. Badges
 * are keyed by city name, so this field goes through user confirmation: we
 * never silently write a badge to the wrong city.
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
