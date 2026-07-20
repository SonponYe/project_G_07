import { createClient, supabaseConfigured } from "./supabase/server";

export type ViewerRole = "viewer" | "officer" | "admin";

export interface Viewer {
  email: string;
  role: ViewerRole;
}

/** Current signed-in user + role, or null (not configured / not signed in). */
export async function getViewer(): Promise<Viewer | null> {
  if (!supabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return {
      email: user.email ?? "",
      role: (profile?.role as ViewerRole) ?? "viewer",
    };
  } catch {
    return null;
  }
}

export function isOfficer(viewer: Viewer | null): boolean {
  return viewer?.role === "officer" || viewer?.role === "admin";
}
