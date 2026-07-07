/**
 * Known localities in the Pra basin for naive SMS geocoding.
 * A community report starting with "GALAM <LOCALITY> ..." is pinned to the
 * locality centroid. Reports with unrecognized localities are still stored
 * (list view), just without a map pin.
 */
export const LOCALITIES: Record<string, { lat: number; lng: number }> = {
  "twifo praso": { lat: 5.6089, lng: -1.5504 },
  daboase: { lat: 5.1594, lng: -1.6631 },
  beposo: { lat: 5.0713, lng: -1.6172 },
  kyekyewere: { lat: 5.7833, lng: -1.4717 },
  "assin praso": { lat: 5.9712, lng: -1.3921 },
  "wassa nkonya": { lat: 5.3208, lng: -1.7042 },
  shama: { lat: 5.0212, lng: -1.6296 },
  "dunkwa-on-offin": { lat: 5.9599, lng: -1.7787 },
};

export function geocodeLocality(
  raw: string
): { locality: string; lat: number; lng: number } | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [name, coords] of Object.entries(LOCALITIES)) {
    if (normalized.startsWith(name)) {
      return { locality: name, ...coords };
    }
  }
  return null;
}
