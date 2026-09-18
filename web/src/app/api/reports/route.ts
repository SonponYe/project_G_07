import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { geocodeLocality } from "@/lib/localities";
import { createRateLimiter, hashIdentifier, insertReportWithCorroboration } from "@/lib/reportIngest";

export const runtime = "nodejs";

/**
 * httpsms.com incoming-SMS webhook (Layer 2 — community verification).
 * httpsms turns an Android phone + SIM into an SMS gateway and posts a
 * JSON event to this URL for every message it receives — a real phone
 * number, not a telecom short code, so anyone can text it directly.
 *
 * Security measures:
 *  1. Shared-secret token in the callback URL, compared in constant time —
 *     the URL itself is the credential (works regardless of whatever
 *     signing scheme, if any, httpsms adds on their end).
 *  2. Phone numbers are HMAC-hashed before storage; raw numbers never
 *     touch the database.
 *  3. Zod validation + message length cap before anything is persisted.
 *  4. Per-sender rate limiting (in-memory; per serverless instance — a
 *     shared store like Upstash would replace this in production).
 *  5. Writes use the service-role key server-side only; RLS blocks all
 *     client-side writes.
 *
 * Expected SMS format (unchanged, provider-agnostic): "GALAM <locality>
 * <what you saw>". Corroboration rule (shared with the web report form —
 * see lib/reportIngest.ts): a second independent report (different
 * sender) within ~2 km upgrades both to "confirmed".
 *
 * Payload shape: httpsms wraps events as `{ event, data: { from/contact,
 * content/text, to/owner, ... } }`. This has been implemented from their
 * public docs but not yet exercised against a live payload — if the first
 * real message doesn't produce a report, check the Vercel function logs:
 * unrecognized payloads are logged in full (never silently dropped) so the
 * exact field names can be confirmed and adjusted in one place below.
 */

const RawEvent = z.object({}).passthrough();
const isRateLimited = createRateLimiter(5, 60 * 60 * 1000); // 5/sender/hour

function constantTimeMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pull { from, text } out of httpsms's event envelope, tolerating a few
 * plausible field-name variants since this hasn't been verified against a
 * live payload yet. Returns null if nothing recognizable is found. */
function extractMessage(body: Record<string, unknown>): { from: string; text: string } | null {
  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;

  const from = data.from ?? data.contact ?? data.sender;
  const text = data.content ?? data.text ?? data.message ?? data.body;

  if (typeof from !== "string" || typeof text !== "string") return null;
  if (from.length < 6 || from.length > 20) return null;
  if (text.length < 1 || text.length > 500) return null;

  return { from, text };
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

  let rawBody: Record<string, unknown>;
  try {
    rawBody = RawEvent.parse(await request.json());
  } catch {
    console.error("[reports webhook] non-JSON or unparseable body");
    return NextResponse.json({ status: "ignored" });
  }

  const extracted = extractMessage(rawBody);
  if (!extracted) {
    // Don't 400 — an unrecognized shape shouldn't make httpsms retry or
    // disable the webhook. Log it so the real field names can be read
    // straight out of the Vercel logs and fixed in extractMessage above.
    console.error("[reports webhook] unrecognized payload shape:", JSON.stringify(rawBody));
    return NextResponse.json({ status: "ignored" });
  }

  const phoneHash = hashIdentifier(extracted.from, hashKey);
  if (isRateLimited(phoneHash)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // Parse "GALAM <locality> <message>" — keyword is forgiving of case.
  const match = extracted.text.match(/^\s*galam\b\s*(.*)$/is);
  if (!match) {
    // Not a report — acknowledge so httpsms doesn't retry, but store nothing.
    return NextResponse.json({ status: "ignored" });
  }
  const messageBody = match[1].trim();
  const geo = geocodeLocality(messageBody);
  const message = geo
    ? messageBody.slice(geo.locality.length).trim() || messageBody
    : messageBody;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const result = await insertReportWithCorroboration(supabase, {
    reporterHash: phoneHash,
    message,
    locality: geo?.locality ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
  });

  if ("error" in result) {
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "received" });
}
