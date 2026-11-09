/** Geographic helpers (spec 11.5). Pure. */
export const EARTH_RADIUS_M = 6_371_000;

const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (haversine; G1/G2: 1° ≈ 111 195 m). */
export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Pace in seconds per km; null below 100 m or with no moving time (spec 11.5). */
export function paceSecondsPerKm(distanceM: number, movingSeconds: number): number | null {
  if (distanceM < 100 || movingSeconds <= 0) return null;
  return movingSeconds / (distanceM / 1000);
}

export const speedMps = (distanceM: number, movingSeconds: number) =>
  movingSeconds > 0 ? distanceM / movingSeconds : 0;

/** "5:00" from 300 s/km; per mile when imperial (G3: 5:00 /km = 8:03 /mi). */
export function formatPace(secondsPerKm: number | null, unit: 'metric' | 'imperial'): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) return '—';
  const s = Math.round(unit === 'metric' ? secondsPerKm : secondsPerKm * 1.609344);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const formatDistance = (m: number, unit: 'metric' | 'imperial') =>
  unit === 'metric' ? `${(m / 1000).toFixed(2)} km` : `${(m / 1609.344).toFixed(2)} mi`;

export const formatSpeed = (mps: number, unit: 'metric' | 'imperial') =>
  unit === 'metric' ? `${(mps * 3.6).toFixed(1)} km/h` : `${(mps * 2.2369363).toFixed(1)} mph`;
