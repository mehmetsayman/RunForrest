"use client";

import { useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type RunData = {
  walletAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  pace: string;
  calories: number;
  avgSpeed: number;
  positions: [number, number][];
};

type SaveRunState = {
  loading: boolean;
  success: boolean;
  error: string | null;
};

export function useSaveRun() {
  const [state, setState] = useState<SaveRunState>({
    loading: false,
    success: false,
    error: null,
  });

  const saveRun = useCallback(async (data: RunData) => {
    // Supabase is optional. Without it the route is not saved, but the run is
    // still written to chain — the caller handles that.
    if (!isSupabaseConfigured) {
      setState({ loading: false, success: true, error: null });
      return true;
    }

    setState({ loading: true, success: false, error: null });

    try {
      const { error } = await supabase.from("runs").insert({
        wallet_address: data.walletAddress,
        distance_meters: data.distanceMeters,
        duration_seconds: data.durationSeconds,
        pace: data.pace,
        calories: data.calories,
        avg_speed: data.avgSpeed,
        positions: data.positions,
      });

      if (error) {
        setState({ loading: false, success: false, error: error.message });
        return false;
      }

      setState({ loading: false, success: true, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save run";
      setState({ loading: false, success: false, error: msg });
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, success: false, error: null });
  }, []);

  return { ...state, saveRun, reset };
}
