import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

/**
 * Shared logic between the two ways a citizen report can arrive — the SMS
 * webhook (api/reports/route.ts) and the web form (api/reports/web/
 * route.ts). Hashing, rate limiting, and the "two independent reports
 * nearby upgrades both to confirmed" corroboration rule are identical
 * either way; only how the report's identity and location are obtained
 * differs (a hashed phone number + locality lookup for SMS, a hashed IP +
 * real GPS coordinates for the web form).
 */

const NEARBY_DEG = 0.02; // ~2 km corroboration radius

export function hashIdentifier(value: string, key: string): string {
  return createHmac("sha256", key).update(value.trim()).digest("hex");
}

/** Per-identity-hash rate limiter. In-memory, so per serverless instance —
 * fine at this scale; a shared store (Upstash) would replace it if this
 * ever needs to hold under real concurrent load. */
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, number[]>();
  return function isRateLimited(hash: string): boolean {
    const now = Date.now();
    const bucket = (buckets.get(hash) ?? []).filter((t) => now - t < windowMs);
    if (bucket.length >= limit) return true;
    bucket.push(now);
    buckets.set(hash, bucket);
    return false;
  };
}

export interface NewReport {
  reporterHash: string;
  message: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
}

/** Inserts a pending report, then upgrades it (and a nearby nearby match)
 * to confirmed if a DIFFERENT reporter already has a pending report within
 * ~2km — the "two independent reports" verification rule. Only runs the
 * corroboration check when coordinates are known (SMS reports without a
 * recognized locality have none, and can't be geographically corroborated
 * this way). */
export async function insertReportWithCorroboration(
  supabase: SupabaseClient,
  report: NewReport
): Promise<{ id: string } | { error: string }> {
  const { data: inserted, error } = await supabase
    .from("community_reports")
    .insert({
      phone_hash: report.reporterHash,
      message: report.message,
      locality: report.locality,
      lat: report.lat,
      lng: report.lng,
      status: "pending",
    })
    .select("id,lat,lng")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "storage failed" };
  }

  if (report.lat != null && report.lng != null) {
    const { data: nearby } = await supabase
      .from("community_reports")
      .select("id")
      .eq("status", "pending")
      .neq("id", inserted.id)
      .neq("phone_hash", report.reporterHash)
      .gte("lat", report.lat - NEARBY_DEG)
      .lte("lat", report.lat + NEARBY_DEG)
      .gte("lng", report.lng - NEARBY_DEG)
      .lte("lng", report.lng + NEARBY_DEG);

    if (nearby && nearby.length > 0) {
      const ids = [inserted.id, ...nearby.map((r) => r.id)];
      await supabase.from("community_reports").update({ status: "confirmed" }).in("id", ids);
    }
  }

  return { id: inserted.id };
}
