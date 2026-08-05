import { redirect } from "next/navigation";

import Dashboard from "@/components/Dashboard";
import { getViewer, isOfficer } from "@/lib/auth";
import { getOfficerDashboardData } from "@/lib/data";
import { supabaseConfigured } from "@/lib/supabase/server";

/**
 * The Authority Portal. Renders the exact same map dashboard the public
 * sees, but backed by an authenticated read that also surfaces
 * `pending_review` sites (RLS's `officers read all sites` policy) — so
 * officers verify new detections against the real before/after imagery on
 * the map, not a bare text list disconnected from geography.
 */
export default async function AdminPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-center text-sm text-neutral-400">
        Moderation requires a configured Supabase project.
      </div>
    );
  }

  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }
  if (!isOfficer(viewer)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-center text-sm text-neutral-400">
        Signed in as {viewer.email}, but this account isn&apos;t an officer.
        Contact an administrator to request access.
      </div>
    );
  }

  const data = await getOfficerDashboardData();
  return <Dashboard initial={data} viewer={viewer} />;
}
