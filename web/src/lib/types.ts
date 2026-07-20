export type DetectionSource = "satellite" | "community" | "both";
export type ReportStatus = "pending" | "confirmed" | "rejected";
export type ReviewStatus = "pending_review" | "published" | "rejected";

export interface ConfirmedSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  areaHa: number | null;
  detectedAt: string;
  detectionSource: DetectionSource;
  ndwiDrop: number | null;
  /** True only when ndwiDrop is present and past the noise threshold —
   * see NDWI_DROP_THRESHOLD in pipeline/config.py. A missing or flat/rising
   * reading is NOT corroboration. */
  waterCorroborated: boolean;
  reviewStatus: ReviewStatus;
  officerNotes: string | null;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  basin: string;
}

export interface CommunityReport {
  id: string;
  message: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  status: ReportStatus;
  matchedSiteId: string | null;
  createdAt: string;
}

export interface RiskFactors {
  site_proximity: number;
  river_proximity: number;
  reserve_proximity: number;
  slope_access: number;
  gold_multiplier: number;
}

export interface RiskCell {
  id: string;
  cellId: string;
  lat: number;
  lng: number;
  cellDeg: number;
  score: number;
  factors: Partial<RiskFactors>;
  windowDays: number;
  computedAt: string;
}

export interface DashboardData {
  sites: ConfirmedSite[];
  reports: CommunityReport[];
  riskCells: RiskCell[];
  /** true when live Supabase env vars are missing and bundled demo data is shown */
  demoMode: boolean;
}

export interface LayerVisibility {
  sites: boolean;
  reports: boolean;
  risk: boolean;
}
