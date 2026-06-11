export function calculateDistance(
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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isPointInCircle(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  return calculateDistance(pointLat, pointLon, centerLat, centerLon) <= radiusMeters;
}

export function isPointInPolygon(
  pointLat: number,
  pointLon: number,
  polygonPoints: Array<{ lat: number; lon: number }>
): boolean {
  let inside = false;
  const n = polygonPoints.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygonPoints[i].lon, yi = polygonPoints[i].lat;
    const xj = polygonPoints[j].lon, yj = polygonPoints[j].lat;

    const intersect =
      yi > pointLat !== yj > pointLat &&
      pointLon < ((xj - xi) * (pointLat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export function generateShortCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}
