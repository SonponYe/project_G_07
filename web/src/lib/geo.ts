/** Great-circle distance in km — accurate enough at map-dashboard scale. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearest<T>(
  point: { lat: number; lng: number },
  items: T[],
  getCoords: (item: T) => { lat: number; lng: number }
): { item: T; distanceKm: number } | null {
  let best: { item: T; distanceKm: number } | null = null;
  for (const item of items) {
    const coords = getCoords(item);
    const distanceKm = haversineKm(point.lat, point.lng, coords.lat, coords.lng);
    if (!best || distanceKm < best.distanceKm) best = { item, distanceKm };
  }
  return best;
}
