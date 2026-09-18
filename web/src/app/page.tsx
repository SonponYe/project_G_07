import { IconMark } from "@/components/icons";
import { getDashboardData } from "@/lib/data";

export const revalidate = 60;

export default async function LandingPage() {
  const data = await getDashboardData();
  const stats = {
    confirmed: data.sites.filter((s) => s.reviewStatus === "published").length,
    pending: data.reports.filter((r) => r.status === "pending").length,
    highRisk: data.riskCells.filter((c) => c.score >= 0.7).length,
  };

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <IconMark className="h-6 w-6 text-gold-500" />
          <span className="text-base font-semibold tracking-tight text-gold-400">G07</span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-neutral-400">
          <a href="/map" className="hover:text-gold-400">
            Live map
          </a>
          <a href="/report" className="hover:text-gold-400">
            Report a site
          </a>
          <a href="/login" className="hover:text-gold-400">
            Officer sign in
          </a>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-geo-pattern border-y border-ink-800">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
            Pronounced &ldquo;Geo-7&rdquo;
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-neutral-50 sm:text-5xl">
            We don&apos;t wait for the river to turn brown.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-400">
            G07 combines satellite detection, water analysis, and reports
            from the people who live along Ghana&apos;s rivers to find
            illegal mining early — and predict where it&apos;s headed next.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/map"
              className="rounded-md bg-gold-500 px-6 py-3 text-sm font-semibold text-black hover:bg-gold-400"
            >
              View the live map
            </a>
            <a
              href="/report"
              className="rounded-md border border-ink-700 px-6 py-3 text-sm font-medium text-neutral-200 hover:border-gold-700 hover:text-gold-300"
            >
              Report a site
            </a>
          </div>
        </div>
      </section>

      {/* ── Live impact ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-14">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-semibold text-red-400">{stats.confirmed}</p>
            <p className="mt-1 text-xs text-neutral-500">Confirmed sites</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-gold-400">{stats.pending}</p>
            <p className="mt-1 text-xs text-neutral-500">Pending reports</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-orange-400">{stats.highRisk}</p>
            <p className="mt-1 text-xs text-neutral-500">High-risk zones</p>
          </div>
        </div>
        {data.demoMode && (
          <p className="mt-4 text-center text-[11px] text-neutral-600">
            Showing seeded demo data — connect a live deployment for real numbers.
          </p>
        )}
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="border-t border-ink-800 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-xl font-semibold text-neutral-100">How it works</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Satellites detect",
                body: "Free Google Earth Engine imagery flags land that flipped from forest to bare ground over a 3-month window — no training data, no black box.",
              },
              {
                n: "2",
                title: "Water & community verify",
                body: "A rise in river turbidity and reports from people nearby independently confirm what the satellites found — or catch what they missed.",
              },
              {
                n: "3",
                title: "The model predicts",
                body: "A transparent, explainable score shows where mining is likely to spread next, so the response can get ahead of it instead of chasing it.",
              },
            ].map((step) => (
              <div key={step.n} className="text-center sm:text-left">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold-700 text-sm font-semibold text-gold-400">
                  {step.n}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-neutral-100">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two audiences ────────────────────────────────────────────── */}
      <section className="border-t border-ink-800 py-16">
        <div className="mx-auto grid max-w-4xl gap-6 px-6 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <h3 className="text-sm font-semibold text-gold-400">For communities</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Report what you see by SMS or on this site — no smartphone or
              data plan required either way. Your identity is never stored,
              only a one-way hash to prevent spam.
            </p>
            <a href="/report" className="mt-3 inline-block text-xs text-gold-500 hover:underline">
              Report a site →
            </a>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <h3 className="text-sm font-semibold text-gold-400">For authorities</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Verify new detections against real before/after satellite
              photos, moderate community reports, and request a targeted
              scan around a fresh tip-off — all backed by Row Level Security.
            </p>
            <a href="/login" className="mt-3 inline-block text-xs text-gold-500 hover:underline">
              Officer sign in →
            </a>
          </div>
        </div>
      </section>

      {/* ── Transparency ─────────────────────────────────────────────── */}
      <section className="border-t border-ink-800 py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-lg font-semibold text-neutral-100">No black boxes</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Every risk score on the map shows exactly what produced it —
            distance to the river, proximity to existing sites and forest
            reserves, terrain access — not a single opaque number. Hover
            any zone on the live map to see the full breakdown.
          </p>
        </div>
      </section>

      <footer className="border-t border-ink-800 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-center text-xs text-neutral-600 sm:flex-row sm:justify-between sm:text-left">
          <p>G07 — satellite + community detection for Ghana&apos;s river basins.</p>
          <div className="flex gap-4">
            <a href="/map" className="hover:text-gold-400">
              Live map
            </a>
            <a href="/report" className="hover:text-gold-400">
              Report a site
            </a>
            <a href="/login" className="hover:text-gold-400">
              Officer sign in
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
