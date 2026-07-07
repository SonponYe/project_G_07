import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { geocodeLocality } from "@/lib/localities";

export const runtime = "nodejs";

/**
 * Africa's Talking incoming-SMS webhook (Layer 2 — community verification).
 *
 * Security measures:
 *  1. Shared-secret token in the callback URL, compared in constant time —
 *     Africa's Talking doesn't sign payloads, so the URL is the credential.
 *  2. Phone numbers are HMAC-hashed before storage; raw numbers never
 *     touch the database.
 *  3. Zod validation + message length cap before anything is persisted.
 *  4. Per-sender rate limiting (in-memory; per serverless instance — a
 *     shared store like Upstash would replace this in production).
 *  5. Writes use the service-role key server-side only; RLS blocks all
 *     client-side writes.
 *
 * Expected SMS format: "GALAM <locality> <what you saw>"
 * Corroboration rule: a second independent report (different sender)
 * within ~2 km upgrades both to "confirmed".
 */

const IncomingSms = z.object({
  from: z.string().min(6).max(20),
  text: z.string().min(1).max(500),
  to: z.string().optional(),
  id: z.string().optional(),
  date: z.string().optional(),
});

const RATE_LIMIT = 5; // reports per sender per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;
const NEARBY_DEG = 0.02; // ~2 km corroboration radius
const rateBuckets = new Map<string, number[]>();

function constantTimeMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function hashPhone(phone: string, key: string): string {
  return createHmac("sha256", key).update(phone.trim()).digest("hex");
}

function isRateLimited(phoneHash: string): boolean {
  const now = Date.now();
  const bucket = (rateBuckets.get(phoneHash) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (bucket.length >= RATE_LIMIT) return true;
  bucket.push(now);
  rateBuckets.set(phoneHash, bucket);
  return false;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.AT_WEBHOOK_SECRET;
  const hashKey = process.env.REPORT_HASH_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !hashKey || !supabaseUrl || !serviceKey) {
    // Fail closed if the route isn't fully configured.
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!constantTimeMatch(token, webhookSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Africa's Talking posts application/x-www-form-urlencoded.
  let parsed: z.infer<typeof IncomingSms>;
  try {
    const form = await request.formData();
    parsed = IncomingSms.parse(Object.fromEntries(form.entries()));
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const phoneHash = hashPhone(parsed.from, hashKey);
  if (isRateLimited(phoneHash)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // Parse "GALAM <locality> <message>" — keyword is forgiving of case.
  const match = parsed.text.match(/^\s*galam\b\s*(.*)$/is);
  if (!match) {
    // Not a report — acknowledge so AT doesn't retry, but store nothing.
    return NextResponse.json({ status: "ignored" });
  }
  const body = match[1].trim();
  const geo = geocodeLocality(body);
  const message = geo
    ? body.slice(geo.locality.length).trim() || body
    : body;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: inserted, error } = await supabase
    .from("community_reports")
    .insert({
      phone_hash: phoneHash,
      message,
      locality: geo?.locality ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      status: "pending",
    })
    .select("id,lat,lng")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }

  // Corroboration: another pending report nearby from a DIFFERENT sender
  // upgrades both to confirmed (the "two independent reports" rule).
  if (geo) {
    const { data: nearby } = await supabase
      .from("community_reports")
      .select("id")
      .eq("status", "pending")
      .neq("id", inserted.id)
      .neq("phone_hash", phoneHash)
      .gte("lat", geo.lat - NEARBY_DEG)
      .lte("lat", geo.lat + NEARBY_DEG)
      .gte("lng", geo.lng - NEARBY_DEG)
      .lte("lng", geo.lng + NEARBY_DEG);

    if (nearby && nearby.length > 0) {
      const ids = [inserted.id, ...nearby.map((r) => r.id)];
      await supabase
        .from("community_reports")
        .update({ status: "confirmed" })
        .in("id", ids);
    }
  }

  return NextResponse.json({ status: "received" });
}
