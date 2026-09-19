export type GpxRunData = {
  positions: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  pace: string;
  calories: number;
  avgSpeed: number;
  startTime: string | null;
  elevationGain: number;
};

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPace(totalSeconds: number, distanceKm: number): string {
  if (distanceKm <= 0) return "0:00";
  const paceSeconds = totalSeconds / distanceKm;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.round(paceSeconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function estimateCalories(distanceKm: number, durationMinutes: number): number {
  const avgWeightKg = 70;
  const met = distanceKm / (durationMinutes / 60) >= 9.5 ? 10 : 8;
  return Math.round((met * avgWeightKg * durationMinutes) / 60);
}

export function parseGpx(xmlText: string): GpxRunData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid GPX file — could not parse XML.");
  }

  const trkpts = doc.querySelectorAll("trkpt");
  if (trkpts.length === 0) {
    throw new Error("No track points found in GPX file.");
  }

  const positions: [number, number][] = [];
  const elevations: number[] = [];
  const times: Date[] = [];

  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute("lat") ?? "0");
    const lon = parseFloat(pt.getAttribute("lon") ?? "0");
    positions.push([lat, lon]);

    const eleEl = pt.querySelector("ele");
    if (eleEl?.textContent) elevations.push(parseFloat(eleEl.textContent));

    const timeEl = pt.querySelector("time");
    if (timeEl?.textContent) times.push(new Date(timeEl.textContent));
  });

  let distanceMeters = 0;
  for (let i = 1; i < positions.length; i++) {
    distanceMeters += haversineDistance(
      positions[i - 1][0],
      positions[i - 1][1],
      positions[i][0],
      positions[i][1]
    );
  }

  let durationSeconds = 0;
  if (times.length >= 2) {
    durationSeconds = Math.round(
      (times[times.length - 1].getTime() - times[0].getTime()) / 1000
    );
  }

  let elevationGain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) elevationGain += diff;
  }

  const distanceKm = distanceMeters / 1000;
  const durationMinutes = durationSeconds / 60;
  const avgSpeed =
    durationSeconds > 0
      ? Math.round((distanceKm / (durationSeconds / 3600)) * 10) / 10
      : 0;
  const pace = formatPace(durationSeconds, distanceKm);
  const calories = estimateCalories(distanceKm, durationMinutes);

  return {
    positions,
    distanceMeters: Math.round(distanceMeters),
    durationSeconds,
    pace,
    calories,
    avgSpeed,
    startTime: times.length > 0 ? times[0].toISOString() : null,
    elevationGain: Math.round(elevationGain),
  };
}
