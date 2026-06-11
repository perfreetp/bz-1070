import * as crypto from 'crypto';

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))) {
    return Infinity;
  }
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));

  return R * c;
}

export function isPointInCircle(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  if (typeof radiusMeters !== 'number' || isNaN(radiusMeters) || radiusMeters <= 0) {
    return false;
  }
  return calculateDistance(pointLat, pointLon, centerLat, centerLon) <= radiusMeters;
}

export function isPointInPolygon(
  pointLat: number,
  pointLon: number,
  polygonPoints: Array<{ lat: number; lon: number }>
): boolean {
  if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) {
    return false;
  }
  let inside = false;
  const n = polygonPoints.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygonPoints[i];
    const pj = polygonPoints[j];
    if (!pi || !pj) continue;
    const xi = pi.lon, yi = pi.lat;
    const xj = pj.lon, yj = pj.lat;
    if (typeof xi !== 'number' || typeof yi !== 'number' ||
        typeof xj !== 'number' || typeof yj !== 'number') continue;

    const denom = yj - yi;
    if (Math.abs(denom) < 1e-12) continue;

    const intersect =
      (yi > pointLat) !== (yj > pointLat) &&
      pointLon < (((xj - xi) * (pointLat - yi)) / denom) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export function generateShortCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const bytes = crypto.randomBytes(Math.max(length, 1));
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i % bytes.length] % chars.length);
  }
  return result;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
