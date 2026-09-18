"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * All writes here run through the signed-in user's own session (RLS-
 * enforced as `authenticated`, never the service role). The `is_officer()`
 * policy in 0002_roles_and_moderation.sql is the real gate — these
 * actions failing silently for a non-officer is expected defense in depth,
 * not the only line of defense.
 */

export async function setSiteReview(id: string, status: "published" | "rejected") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("confirmed_sites")
    .update({ review_status: status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/map");
}

export async function setReportStatus(id: string, status: "confirmed" | "rejected") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("community_reports")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/map");
}

/** Officer requests a targeted scan (center + radius) instead of an
 * officer having to wait for/ask for a whole-basin run. Lands as a
 * 'queued' row — see pipeline_runs and pipeline/run_pipeline.py
 * --from-queue for how it actually gets fulfilled. */
export async function requestPipelineRun(input: {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  basin: string;
  label: string;
  notes: string;
  reportId: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("pipeline_runs").insert({
    requested_by: user.id,
    center_lat: input.centerLat,
    center_lng: input.centerLng,
    radius_m: input.radiusM,
    basin: input.basin,
    label: input.label || null,
    notes: input.notes || null,
    report_id: input.reportId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
