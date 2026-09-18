import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRateLimiter, hashIdentifier, insertReportWithCorroboration } from "@/lib/reportIngest";

export const runtime = "nodejs";

/**
 * Web report form submission (/report) — Layer 2 alongside the SMS
 * webhook. Unlike SMS, the reporter's browser supplies real GPS
 * coordinates directly (mandatory on the form — no manual-entry
 * fallback), so there's no locality lookup table involved here.
 *
 * Security measures:
 *  1. Zod validation: coordinate bounds, message length cap.
 *  2. No phone number to hash here — instead the requester's IP is
 *     hashed (same HMAC key/pattern as SMS phone numbers) purely for
 *     rate-limiting; never stored against the report itself beyond the
 *     hash, and never exposed.
 *  3. Per-IP-hash rate limiting (in-memory; see lib/reportIngest.ts).
 *  4. Writes use the service-role key server-side only; RLS blocks all
 *     client-side writes. Nothing here bypasses officer moderation —
 *     it lands as a normal pending report like any other.
 */

const WebReport = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  message: z.string().min(1).max(500),
});

const isRateLimited = createRateLimiter(5, 60 * 60 * 1000); // 5/IP/hour

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const hashKey = process.env.REPORT_HASH_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hashKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let body: z.infer<typeof WebReport>;
  try {
    body = WebReport.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid report" }, { status: 400 });
  }

  const ipHash = hashIdentifier(clientIp(request), hashKey);
  if (isRateLimited(ipHash)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const result = await insertReportWithCorroboration(supabase, {
    reporterHash: ipHash,
    message: body.message,
    locality: null,
    lat: body.lat,
    lng: body.lng,
  });

  if ("error" in result) {
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "received", id: result.id });
}
