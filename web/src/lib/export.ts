import type { ConfirmedSite, RiskCell } from "./types";

/** Client-side download — no server round trip, works offline once the
 * dashboard has loaded, matching the "must never depend on a live API"
 * rule the rest of the demo follows. */
function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/geo+json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportSitesGeoJSON(sites: ConfirmedSite[]) {
  downloadJson(`galamsey-eye-confirmed-sites-${dateStamp()}.geojson`, {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [site.lng, site.lat] },
      properties: {
        name: site.name,
        area_ha: site.areaHa,
        detected_at: site.detectedAt,
        detection_source: site.detectionSource,
        water_corroborated: site.waterCorroborated,
        basin: site.basin,
      },
    })),
  });
}

/** Only the zones a district task force would actually act on. */
export function exportHighRiskGeoJSON(cells: RiskCell[], minScore = 0.5) {
  const highRisk = cells.filter((c) => c.score >= minScore);
  downloadJson(`galamsey-eye-risk-zones-${dateStamp()}.geojson`, {
    type: "FeatureCollection",
    features: highRisk.map((cell) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [cell.lng, cell.lat] },
      properties: {
        score: cell.score,
        window_days: cell.windowDays,
        factors: cell.factors,
      },
    })),
  });
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
