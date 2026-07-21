import { redirect } from "next/navigation";

import { getViewer, isOfficer } from "@/lib/auth";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

import AdminQueue from "./AdminQueue";

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

  const supabase = await createClient();
  const [sitesRes, reportsRes] = await Promise.all([
    supabase
      .from("confirmed_sites")
      .select("id,name,lat,lng,area_ha,detection_source,water_corroborated,detected_at")
      .eq("review_status", "pending_review")
      .order("detected_at", { ascending: false }),
    supabase
      .from("community_reports")
      .select("id,message,locality,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="h-1 w-full bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
      <AdminQueue
        viewerEmail={viewer.email}
        sites={(sitesRes.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          areaHa: s.area_ha,
          detectionSource: s.detection_source,
          waterCorroborated: s.water_corroborated,
          detectedAt: s.detected_at,
        }))}
        reports={(reportsRes.data ?? []).map((r) => ({
          id: r.id,
          message: r.message,
          locality: r.locality,
          createdAt: r.created_at,
        }))}
      />
    </div>
  );
}
