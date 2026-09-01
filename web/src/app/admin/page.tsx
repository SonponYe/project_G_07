import { redirect } from "next/navigation";

import Dashboard from "@/components/Dashboard";
import GateMessage from "@/components/GateMessage";
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
      <GateMessage
        title="Not configured"
        message="Moderation requires a configured Supabase project on this deployment."
        action={{ href: "/", label: "Back to public dashboard" }}
      />
    );
  }

  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }
  if (!isOfficer(viewer)) {
    return (
      <GateMessage
        title="Access restricted"
        message={`Signed in as ${viewer.email}, but this account isn't an officer. Contact an administrator to request access.`}
        action={{ href: "/", label: "Back to public dashboard" }}
      />
    );
  }

  const data = await getOfficerDashboardData();
  return <Dashboard initial={data} viewer={viewer} />;
}
