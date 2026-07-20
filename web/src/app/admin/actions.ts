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
  revalidatePath("/");
}

export async function setReportStatus(id: string, status: "confirmed" | "rejected") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("community_reports")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
