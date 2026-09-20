"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type LatLng = [number, number];

type TrackingState = "idle" | "tracking" | "paused" | "complete";

type RunStats = {
  distance: number; // meters
  duration: number; // seconds
  pace: string; // min/km
  calories: number;
  avgSpeed: number; // km/h
  positions: LatLng[];
  currentPosition: LatLng | null;
  /** Horizontal accuracy of the last reading (metres). Shown to the user. */
  accuracy: number | null;
  startTime: number | null;
};

type GpsTracking = {
  state: TrackingState;
  stats: RunStats;
  error: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  hasPermission: boolean | null;
};

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatPace(metersPerSecond: number): string {
  if (metersPerSecond <= 0) return "--:--";
  const paceSeconds = 1000 / metersPerSecond;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Rough calorie estimate, distance-based (~60 kcal/km for a 70 kg runner).
 * Duration is deliberately ignored: correcting for pace adds no meaningful
 * accuracy without body weight and heart-rate data.
 */
function estimateCalories(distanceKm: number): number {
  return Math.round(distanceKm * 60);
}

const INITIAL_STATS: RunStats = {
  distance: 0,
  duration: 0,
  pace: "--:--",
  calories: 0,
  avgSpeed: 0,
  positions: [],
  currentPosition: null,
  accuracy: null,
  startTime: null,
};

/**
 * Maximum position error (metres) accepted for COUNTING distance.
 *
 * The threshold filters distance accumulation only; the position itself is
 * always drawn on the map. Discarding readings above it outright is tempting
 * but wrong: on a desktop the position comes from Wi-Fi and accuracy is
 * usually worse than 100 m, so NO point would ever be recorded — the UI would
 * say "GPS active" while distance stayed at 0 m, with no map and no reason given.
 */
const MIN_ACCURACY = 50; // on a real run, phone GPS is typically 5–20 m
const MIN_DISTANCE = 2; // meters - minimum movement to record

export function useGpsTracking(): GpsTracking {
  const [state, setState] = useState<TrackingState>("idle");
  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed =
        (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000;
      setStats((prev) => ({
        ...prev,
        duration: Math.floor(elapsed),
      }));
    }, 1000);
  }, [clearTimer]);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError("GPS desteklenmiyor");
      return;
    }

    setError(null);
    setState("tracking");
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;

    setStats({
      ...INITIAL_STATS,
      startTime: Date.now(),
    });

    startTimer();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setHasPermission(true);
        const { latitude, longitude, accuracy } = position.coords;
        const newPos: LatLng = [latitude, longitude];

        // On poor accuracy, STILL show the position (so the user gets a map),
        // but do not add to distance — jumping readings would invent kilometres.
        if (accuracy > MIN_ACCURACY) {
          setStats((prev) => ({ ...prev, currentPosition: newPos, accuracy }));
          return;
        }

        setStats((prev) => {
          const prevPositions = prev.positions;
          const lastPos =
            prevPositions.length > 0
              ? prevPositions[prevPositions.length - 1]
              : null;

          if (lastPos) {
            const dist = haversineDistance(lastPos, newPos);
            if (dist < MIN_DISTANCE) {
              return { ...prev, currentPosition: newPos, accuracy };
            }
          }

          const newPositions = [...prevPositions, newPos];
          const totalDistance = lastPos
            ? prev.distance + haversineDistance(lastPos, newPos)
            : prev.distance;

          const durationSec = prev.duration || 1;
          const speedMs = totalDistance / durationSec;
          const distanceKm = totalDistance / 1000;
          const durationMin = durationSec / 60;

          return {
            ...prev,
            positions: newPositions,
            currentPosition: newPos,
            accuracy,
            distance: totalDistance,
            pace: formatPace(speedMs),
            avgSpeed: parseFloat(((distanceKm / durationMin) * 60).toFixed(1)),
            calories: estimateCalories(distanceKm),
          };
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setHasPermission(false);
          setError("Location permission denied. Please allow it in your settings.");
          setState("idle");
          clearWatch();
          clearTimer();
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Cannot get a location. The GPS signal is weak.");
        } else if (err.code === err.TIMEOUT) {
          setError("GPS timed out. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 30000,
      }
    );
  }, [startTimer, clearWatch, clearTimer]);

  const pause = useCallback(() => {
    setState("paused");
    clearWatch();
    clearTimer();
    pauseStartRef.current = Date.now();
  }, [clearWatch, clearTimer]);

  const resume = useCallback(() => {
    if (pauseStartRef.current) {
      pausedDurationRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setState("tracking");
    startTimer();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos: LatLng = [latitude, longitude];
        if (accuracy > MIN_ACCURACY) {
          setStats((prev) => ({ ...prev, currentPosition: newPos, accuracy }));
          return;
        }

        setStats((prev) => {
          const lastPos =
            prev.positions.length > 0
              ? prev.positions[prev.positions.length - 1]
              : null;

          if (lastPos) {
            const dist = haversineDistance(lastPos, newPos);
            if (dist < MIN_DISTANCE) {
              return { ...prev, currentPosition: newPos, accuracy };
            }
          }

          const newPositions = [...prev.positions, newPos];
          const totalDistance = lastPos
            ? prev.distance + haversineDistance(lastPos, newPos)
            : prev.distance;

          const durationSec = prev.duration || 1;
          const speedMs = totalDistance / durationSec;
          const distanceKm = totalDistance / 1000;
          const durationMin = durationSec / 60;

          return {
            ...prev,
            positions: newPositions,
            currentPosition: newPos,
            accuracy,
            distance: totalDistance,
            pace: formatPace(speedMs),
            avgSpeed: parseFloat(((distanceKm / durationMin) * 60).toFixed(1)),
            calories: estimateCalories(distanceKm),
          };
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }, [startTimer]);

  const stop = useCallback(() => {
    setState("complete");
    clearWatch();
    clearTimer();
  }, [clearWatch, clearTimer]);

  const reset = useCallback(() => {
    setState("idle");
    clearWatch();
    clearTimer();
    setStats(INITIAL_STATS);
    setError(null);
    startTimeRef.current = null;
    pausedDurationRef.current = 0;
    pauseStartRef.current = null;
  }, [clearWatch, clearTimer]);

  useEffect(() => {
    return () => {
      clearWatch();
      clearTimer();
    };
  }, [clearWatch, clearTimer]);

  return {
    state,
    stats,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
    hasPermission,
  };
}
