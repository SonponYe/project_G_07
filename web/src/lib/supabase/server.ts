import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Returns null when Supabase env vars are absent — callers should treat
 * that as "auth unavailable" and fall back gracefully (demo mode). */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Server Component / Server Action client — reads the session from
 * request cookies and enforces RLS as the signed-in user (never the
 * service role). Used by /admin and its server actions. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — middleware.ts is
            // responsible for refreshing the session cookie in that case.
          }
        },
      },
    }
  );
}
