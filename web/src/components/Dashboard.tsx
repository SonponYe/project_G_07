"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import type { Viewer } from "@/lib/auth";
import { exportHighRiskGeoJSON, exportSitesGeoJSON } from "@/lib/export";
import type { ConfirmedSite, DashboardData, LayerVisibility } from "@/lib/types";

import LayerControls from "./LayerControls";
import Legend from "./Legend";
import SitePanel from "./SitePanel";

// Leaflet touches `window` at import time — client-only, no SSR.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-neutral-500">
      Loading map…
    </div>
  ),
});

export default function Dashboard({
  initial,
  viewer,
}: {
  initial: DashboardData;
  viewer: Viewer | null;
}) {
  const [layers, setLayers] = useState<LayerVisibility>({
    sites: true,
    reports: true,
    risk: true,
  });
  const [selectedSite, setSelectedSite] = useState<ConfirmedSite | null>(null);
  const isOfficer = viewer?.role === "officer" || viewer?.role === "admin";

  const stats = useMemo(
    () => ({
      confirmed: initial.sites.length,
      pending: initial.reports.filter((r) => r.status === "pending").length,
      highRisk: initial.riskCells.filter((c) => c.score >= 0.7).length,
    }),
    [initial]
  );

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      <header className="flex items-center justify-between border-b border-gold-800/40 bg-black px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-gold-400">
            Galamsey <span className="text-neutral-100">Eye</span>
          </h1>
          <span className="text-xs text-neutral-500">
            Pra River Basin · satellite + community monitoring
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {initial.demoMode && (
            <span className="rounded-full border border-gold-700/40 bg-gold-950/40 px-2.5 py-1 font-medium text-gold-400">
              Demo mode — seeded data
            </span>
          )}
          <span className="text-neutral-300">
            <b className="text-red-400">{stats.confirmed}</b> confirmed sites
          </span>
          <span className="text-neutral-300">
            <b className="text-gold-400">{stats.pending}</b> pending reports
          </span>
          <span className="text-neutral-300">
            <b className="text-orange-400">{stats.highRisk}</b> high-risk zones
          </span>
          {isOfficer ? (
            <a
              href="/admin"
              className="rounded-md border border-gold-600 bg-gold-500/10 px-2.5 py-1 font-medium text-gold-300 hover:bg-gold-500/20"
            >
              Moderation queue
            </a>
          ) : (
            <a
              href="/login"
              className="rounded-md border border-ink-700 px-2.5 py-1 text-neutral-500 hover:border-gold-700 hover:text-gold-400"
            >
              Officer sign in
            </a>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-ink-800 bg-ink-950 p-4">
          <LayerControls layers={layers} onChange={setLayers} />
          <Legend />

          <div className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-xs leading-relaxed text-neutral-400">
            <p className="mb-1 font-medium text-gold-400">Report a site by SMS</p>
            <p>
              Text{" "}
              <code className="rounded bg-ink-800 px-1 py-0.5 text-gold-300">
                GALAM &lt;town&gt; &lt;what you saw&gt;
              </code>{" "}
              to the short code. No smartphone or data plan needed.
            </p>
          </div>

          {isOfficer && (
            <section className="rounded-lg border border-gold-700/50 bg-gold-950/20 p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-500">
                Authority tools
              </h2>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => exportSitesGeoJSON(initial.sites)}
                  className="rounded-md border border-gold-700/60 px-2.5 py-1.5 text-left text-xs text-gold-200 hover:bg-gold-900/30"
                >
                  Confirmed sites (GeoJSON)
                </button>
                <button
                  onClick={() => exportHighRiskGeoJSON(initial.riskCells, 0.5)}
                  className="rounded-md border border-gold-700/60 px-2.5 py-1.5 text-left text-xs text-gold-200 hover:bg-gold-900/30"
                >
                  High-risk zones ≥50% (GeoJSON)
                </button>
              </div>
            </section>
          )}
        </aside>

        <main className="relative min-w-0 flex-1">
          <MapView
            sites={initial.sites}
            reports={initial.reports}
            riskCells={initial.riskCells}
            layers={layers}
            selectedSiteId={selectedSite?.id ?? null}
            onSelectSite={setSelectedSite}
          />
          {selectedSite && (
            <SitePanel
              site={selectedSite}
              reports={initial.reports.filter(
                (r) => r.matchedSiteId === selectedSite.id
              )}
              onClose={() => setSelectedSite(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
