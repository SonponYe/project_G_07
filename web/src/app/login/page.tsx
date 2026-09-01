"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconChevronLeft, IconMark } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

/**
 * Officer sign-in. There is no self-signup here on purpose — officer
 * accounts (EPA, Forestry Commission, task force) are provisioned
 * manually via the Supabase dashboard + a profiles row, mirroring how
 * real institutional access would be granted rather than public signup.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-geo-pattern flex min-h-screen flex-col">
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-black/90 p-6 shadow-2xl backdrop-blur sm:p-7">
          <div className="mb-5 flex flex-col items-center text-center">
            <IconMark className="mb-3 h-12 w-12 text-gold-500" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">
              Authority Portal
            </p>
            <h1 className="mt-1 text-lg font-semibold text-gold-300">
              Galamsey Eye — Officer sign-in
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              EPA, Forestry Commission, and task force accounts only.
            </p>
          </div>

          {!configured ? (
            <p className="rounded-md border border-gold-700/40 bg-gold-950/30 p-3 text-xs text-gold-300">
              Authentication isn&apos;t configured on this deployment (no
              Supabase credentials). The public dashboard is still available.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-neutral-400">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-gold-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-neutral-400">
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-gold-500"
                />
              </label>
              {error && (
                <p className="rounded-md border border-red-900/60 bg-red-950/40 p-2 text-xs text-red-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-md bg-gold-500 px-3 py-2 text-sm font-semibold text-black hover:bg-gold-400 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          <a
            href="/"
            className="mt-5 flex items-center justify-center gap-1 text-center text-xs text-neutral-600 hover:text-gold-500"
          >
            <IconChevronLeft className="h-3 w-3" />
            Back to the public dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
