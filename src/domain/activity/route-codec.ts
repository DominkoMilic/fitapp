/**
 * Compact route file (spec 11.7): one JSON object per activity with polyline-encoded pieces
 * (precision 1e5 ≈ 1 m), delta-encoded times (s) and rounded accuracy/altitude. Pure.
 */
import type { RawPoint } from './gps-filter';

export interface RouteFile {
  v: 1;
  pieces: { p: string; t: number[]; a: (number | null)[]; z: (number | null)[]; t0: number }[];
}

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodePolyline(points: readonly { lat: number; lng: number }[]): string {
  let lat = 0;
  let lng = 0;
  let out = '';
  for (const p of points) {
    const la = Math.round(p.lat * 1e5);
    const ln = Math.round(p.lng * 1e5);
    out += encodeValue(la - lat) + encodeValue(ln - lng);
    lat = la;
    lng = ln;
  }
  return out;
}

export function decodePolyline(s: string): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (i >= s.length) throw new Error('Invalid polyline');
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next();
    lng += next();
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

export function encodeRoute(pieces: readonly (readonly RawPoint[])[]): RouteFile {
  return {
    v: 1,
    pieces: pieces
      .filter((p) => p.length)
      .map((piece) => {
        const t0 = piece[0]!.t;
        let prev = t0;
        return {
          p: encodePolyline(piece),
          t0,
          t: piece.map((pt) => {
            const d = Math.round((pt.t - prev) / 1000);
            prev = pt.t;
            return d;
          }),
          a: piece.map((pt) => (pt.acc === null ? null : Math.round(pt.acc))),
          z: piece.map((pt) => (pt.alt === null ? null : Math.round(pt.alt))),
        };
      }),
  };
}

/** Decodes and validates; returns null for anything malformed (never throws to the UI). */
export function decodeRoute(file: unknown): { lat: number; lng: number }[][] | null {
  if (
    !file ||
    typeof file !== 'object' ||
    (file as RouteFile).v !== 1 ||
    !Array.isArray((file as RouteFile).pieces)
  )
    return null;
  try {
    return (file as RouteFile).pieces.map((p) =>
      typeof p.p === 'string' ? decodePolyline(p.p) : [],
    );
  } catch {
    return null;
  }
}

/** Full points (time, accuracy, altitude) for recomputing metrics; null when malformed. */
export function decodeRoutePoints(file: unknown): RawPoint[][] | null {
  if (!decodeRoute(file)) return null;
  try {
    return (file as RouteFile).pieces.map((p) => {
      const coords = decodePolyline(p.p);
      if (!Array.isArray(p.t) || p.t.length !== coords.length || typeof p.t0 !== 'number')
        throw new Error('bad times');
      let t = p.t0;
      return coords.map((c, i) => {
        t += (p.t[i] ?? 0) * 1000;
        const acc = p.a?.[i];
        const alt = p.z?.[i];
        return {
          t,
          lat: c.lat,
          lng: c.lng,
          acc: typeof acc === 'number' ? acc : null,
          alt: typeof alt === 'number' ? alt : null,
        };
      });
    });
  } catch {
    return null;
  }
}
