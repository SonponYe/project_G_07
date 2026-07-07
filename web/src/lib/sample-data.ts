import type { CommunityReport, ConfirmedSite, RiskCell } from "./types";

/**
 * Bundled known-good demo dataset (mirrors supabase/seed.sql).
 * The dashboard falls back to this when Supabase env vars are absent or a
 * fetch fails, so the judging demo never depends on live internet/API calls.
 */

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export const SAMPLE_SITES: ConfirmedSite[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    name: "Twifo Praso North",
    lat: 5.641,
    lng: -1.549,
    areaHa: 14.2,
    detectedAt: daysAgo(9),
    detectionSource: "both",
    ndwiDrop: -0.21,
    beforeImageUrl: null,
    afterImageUrl: null,
    basin: "pra",
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    name: "Daboase Riverbend",
    lat: 5.162,
    lng: -1.663,
    areaHa: 8.7,
    detectedAt: daysAgo(21),
    detectionSource: "satellite",
    ndwiDrop: -0.14,
    beforeImageUrl: null,
    afterImageUrl: null,
    basin: "pra",
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    name: "Beposo Floodplain",
    lat: 5.071,
    lng: -1.618,
    areaHa: 22.5,
    detectedAt: daysAgo(34),
    detectionSource: "satellite",
    ndwiDrop: -0.29,
    beforeImageUrl: null,
    afterImageUrl: null,
    basin: "pra",
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    name: "Kyekyewere Tributary",
    lat: 5.783,
    lng: -1.472,
    areaHa: 5.1,
    detectedAt: daysAgo(5),
    detectionSource: "community",
    ndwiDrop: null,
    beforeImageUrl: null,
    afterImageUrl: null,
    basin: "pra",
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    name: "Assin Praso West",
    lat: 5.972,
    lng: -1.391,
    areaHa: 11.8,
    detectedAt: daysAgo(15),
    detectionSource: "both",
    ndwiDrop: -0.18,
    beforeImageUrl: null,
    afterImageUrl: null,
    basin: "pra",
  },
];

export const SAMPLE_REPORTS: CommunityReport[] = [
  { id: "r01", message: "Excavator moved into forest near the river last night", locality: "Twifo Praso", lat: 5.6435, lng: -1.5461, status: "confirmed", matchedSiteId: "a1000000-0000-4000-8000-000000000001", createdAt: daysAgo(10) },
  { id: "r02", message: "Water turned brown since Tuesday, machines heard upstream", locality: "Twifo Praso", lat: 5.6398, lng: -1.5512, status: "confirmed", matchedSiteId: "a1000000-0000-4000-8000-000000000001", createdAt: daysAgo(9) },
  { id: "r03", message: "New pit opened behind the cocoa farms", locality: "Kyekyewere", lat: 5.7841, lng: -1.4705, status: "confirmed", matchedSiteId: "a1000000-0000-4000-8000-000000000004", createdAt: daysAgo(6) },
  { id: "r04", message: "Trucks carrying gravel out at dawn, no company sign", locality: "Kyekyewere", lat: 5.7818, lng: -1.4739, status: "confirmed", matchedSiteId: "a1000000-0000-4000-8000-000000000004", createdAt: daysAgo(5) },
  { id: "r05", message: "Strange pumping sounds from the reserve edge", locality: "Assin Praso", lat: 5.9748, lng: -1.3889, status: "confirmed", matchedSiteId: "a1000000-0000-4000-8000-000000000005", createdAt: daysAgo(14) },
  { id: "r06", message: "Two changfan machines on the river near the old ferry point", locality: "Daboase", lat: 5.1651, lng: -1.6602, status: "pending", matchedSiteId: null, createdAt: daysAgo(3) },
  { id: "r07", message: "Cleared patch visible from the road to Beposo", locality: "Beposo", lat: 5.0742, lng: -1.6155, status: "pending", matchedSiteId: null, createdAt: daysAgo(2) },
  { id: "r08", message: "Men surveying land next to the stream, say they have permit", locality: "Wassa Nkonya", lat: 5.321, lng: -1.704, status: "pending", matchedSiteId: null, createdAt: daysAgo(2) },
  { id: "r09", message: "River fish dying near the bend, oily film on water", locality: "Daboase", lat: 5.159, lng: -1.666, status: "pending", matchedSiteId: null, createdAt: daysAgo(1) },
  { id: "r10", message: "Generator running all night in the forest across the river", locality: "Twifo Praso", lat: 5.648, lng: -1.543, status: "pending", matchedSiteId: null, createdAt: daysAgo(1) },
  { id: "r11", message: "New access road being cut toward the reserve boundary", locality: "Assin Praso", lat: 5.969, lng: -1.395, status: "pending", matchedSiteId: null, createdAt: daysAgo(0.5) },
  { id: "r12", message: "Excavator offloaded from truck at junction, heading east", locality: "Beposo", lat: 5.069, lng: -1.621, status: "pending", matchedSiteId: null, createdAt: daysAgo(0.25) },
];

const cell = (
  cellId: string,
  lat: number,
  lng: number,
  score: number,
  site: number,
  river: number,
  reserve: number,
  slope: number
): RiskCell => ({
  id: cellId,
  cellId,
  lat,
  lng,
  cellDeg: 0.01,
  score,
  factors: {
    site_proximity: site,
    river_proximity: river,
    reserve_proximity: reserve,
    slope_access: slope,
    gold_multiplier: 1.0,
  },
  windowDays: 60,
  computedAt: daysAgo(0.1),
});

export const SAMPLE_RISK: RiskCell[] = [
  cell("pra_5.63_-1.56", 5.63, -1.56, 0.91, 0.95, 0.92, 0.8, 0.94),
  cell("pra_5.62_-1.55", 5.62, -1.55, 0.87, 0.9, 0.95, 0.72, 0.9),
  cell("pra_5.65_-1.54", 5.65, -1.54, 0.83, 0.88, 0.85, 0.75, 0.82),
  cell("pra_5.66_-1.53", 5.66, -1.53, 0.74, 0.78, 0.8, 0.68, 0.7),
  cell("pra_5.60_-1.57", 5.6, -1.57, 0.68, 0.72, 0.75, 0.55, 0.71),
  cell("pra_5.79_-1.46", 5.79, -1.46, 0.82, 0.92, 0.7, 0.85, 0.8),
  cell("pra_5.78_-1.48", 5.78, -1.48, 0.77, 0.85, 0.72, 0.78, 0.75),
  cell("pra_5.77_-1.47", 5.77, -1.47, 0.71, 0.8, 0.68, 0.7, 0.68),
  cell("pra_5.98_-1.38", 5.98, -1.38, 0.79, 0.88, 0.74, 0.82, 0.72),
  cell("pra_5.96_-1.40", 5.96, -1.4, 0.73, 0.82, 0.76, 0.66, 0.7),
  cell("pra_5.95_-1.38", 5.95, -1.38, 0.66, 0.74, 0.7, 0.6, 0.62),
  cell("pra_5.17_-1.65", 5.17, -1.65, 0.75, 0.84, 0.88, 0.5, 0.78),
  cell("pra_5.15_-1.67", 5.15, -1.67, 0.69, 0.76, 0.82, 0.48, 0.74),
  cell("pra_5.08_-1.61", 5.08, -1.61, 0.81, 0.9, 0.86, 0.58, 0.85),
  cell("pra_5.06_-1.62", 5.06, -1.62, 0.72, 0.8, 0.84, 0.52, 0.76),
  cell("pra_5.09_-1.63", 5.09, -1.63, 0.64, 0.7, 0.78, 0.5, 0.66),
  cell("pra_5.44_-1.62", 5.44, -1.62, 0.55, 0.58, 0.72, 0.44, 0.6),
  cell("pra_5.33_-1.68", 5.33, -1.68, 0.49, 0.5, 0.66, 0.4, 0.55),
  cell("pra_5.52_-1.59", 5.52, -1.59, 0.58, 0.62, 0.74, 0.42, 0.64),
  cell("pra_5.70_-1.51", 5.7, -1.51, 0.61, 0.66, 0.7, 0.52, 0.62),
];
