import { createClient } from "@supabase/supabase-js";

import { SAMPLE_REPORTS, SAMPLE_RISK, SAMPLE_SITES } from "./sample-data";
import { createClient as createAuthedClient } from "./supabase/server";
import type {
  CommunityReport,
  ConfirmedSite,
  DashboardData,
  PipelineRun,
  RiskCell,
} from "./types";

const PIPELINE_RUN_COLUMNS =
  "id,center_lat,center_lng,radius_m,basin,label,notes,report_id,status,sites_found,error_message,created_at,started_at,completed_at";

const SITE_COLUMNS =
  "id,name,lat,lng,area_ha,detected_at,detection_source,ndwi_drop,water_corroborated,review_status,officer_notes,before_image_url,after_image_url,basin";
const REPORT_COLUMNS = "id,message,locality,lat,lng,status,matched_site_id,created_at";
const RISK_COLUMNS = "id,cell_id,lat,lng,cell_deg,score,factors,window_days,computed_at";

/**
 * Server-side data access for the dashboard. Reads use the ANON key only —
 * RLS restricts it to SELECT, so even if leaked it cannot write anything.
 *
 * Resilience rule from the project doc: the demo must never depend on a
 * live API. Missing env vars or any fetch error → bundled sample dataset.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return demoData();
  }

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    const [sitesRes, reportsRes, riskRes] = await Promise.all([
      supabase
        .from("confirmed_sites")
        .select(SITE_COLUMNS)
        // RLS already restricts anon reads to review_status='published',
        // but scope explicitly so intent is clear from the query alone.
        .eq("review_status", "published")
        .order("detected_at", { ascending: false }),
      supabase
        .from("community_reports")
        .select(REPORT_COLUMNS)
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("risk_scores")
        .select(RISK_COLUMNS)
        .order("score", { ascending: false })
        .limit(2000),
    ]);

    if (sitesRes.error || reportsRes.error || riskRes.error) {
      return demoData();
    }

    return {
      demoMode: false,
      sites: (sitesRes.data ?? []).map(mapSite),
      reports: (reportsRes.data ?? []).map(mapReport),
      riskCells: (riskRes.data ?? []).map(mapRisk),
    };
  } catch {
    return demoData();
  }
}

/**
 * Officer-scoped reads — uses the signed-in user's own authenticated
 * session (cookie-based), not the anon key. RLS's `officers read all
 * sites` policy then also returns `pending_review`/`rejected` sites, which
 * anon reads never see. Falls back to the public dataset (not demo data)
 * on any failure, since a signed-in officer should still see real data
 * even if this richer read fails for some reason.
 */
export async function getOfficerDashboardData(): Promise<DashboardData> {
  try {
    const supabase = await createAuthedClient();

    const [sitesRes, reportsRes, riskRes] = await Promise.all([
      supabase.from("confirmed_sites").select(SITE_COLUMNS).order("detected_at", { ascending: false }),
      supabase
        .from("community_reports")
        .select(REPORT_COLUMNS)
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("risk_scores").select(RISK_COLUMNS).order("score", { ascending: false }).limit(2000),
    ]);

    if (sitesRes.error || reportsRes.error || riskRes.error) {
      return getDashboardData();
    }

    return {
      demoMode: false,
      sites: (sitesRes.data ?? []).map(mapSite),
      reports: (reportsRes.data ?? []).map(mapReport),
      riskCells: (riskRes.data ?? []).map(mapRisk),
    };
  } catch {
    return getDashboardData();
  }
}

/** Officer-only — the pipeline_runs queue. Empty array on any failure
 * (missing config, not signed in, RLS denial) rather than throwing, since
 * this is a secondary panel that shouldn't break the whole dashboard. */
export async function getPipelineRuns(): Promise<PipelineRun[]> {
  try {
    const supabase = await createAuthedClient();
    const { data, error } = await supabase
      .from("pipeline_runs")
      .select(PIPELINE_RUN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map(mapPipelineRun);
  } catch {
    return [];
  }
}

function demoData(): DashboardData {
  return {
    demoMode: true,
    sites: SAMPLE_SITES,
    reports: SAMPLE_REPORTS,
    riskCells: SAMPLE_RISK,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSite(row: any): ConfirmedSite {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    areaHa: row.area_ha,
    detectedAt: row.detected_at,
    detectionSource: row.detection_source,
    ndwiDrop: row.ndwi_drop,
    waterCorroborated: row.water_corroborated ?? false,
    reviewStatus: row.review_status ?? "published",
    officerNotes: row.officer_notes ?? null,
    beforeImageUrl: row.before_image_url,
    afterImageUrl: row.after_image_url,
    basin: row.basin,
  };
}

function mapReport(row: any): CommunityReport {
  return {
    id: row.id,
    message: row.message,
    locality: row.locality,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    matchedSiteId: row.matched_site_id,
    createdAt: row.created_at,
  };
}

function mapRisk(row: any): RiskCell {
  return {
    id: row.id,
    cellId: row.cell_id,
    lat: row.lat,
    lng: row.lng,
    cellDeg: row.cell_deg,
    score: row.score,
    factors: row.factors ?? {},
    windowDays: row.window_days,
    computedAt: row.computed_at,
  };
}

function mapPipelineRun(row: any): PipelineRun {
  return {
    id: row.id,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    radiusM: row.radius_m,
    basin: row.basin,
    label: row.label,
    notes: row.notes,
    reportId: row.report_id,
    status: row.status,
    sitesFound: row.sites_found,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
