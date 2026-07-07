"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import type { ConfirmedSite, DashboardData, LayerVisibility } from "@/lib/types";

import LayerControls from "./LayerControls";
import Legend from "./Legend";
import SitePanel from "./SitePanel";

// Leaflet touches `window` at import time — client-only, no SSR.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      Loading map…
    </div>
  ),
});

export default function Dashboard({ initial }: { initial: DashboardData }) {
  const [layers, setLayers] = useState<LayerVisibility>({
    sites: true,
    reports: true,
    risk: true,
  });
  const [selectedSite, setSelectedSite] = useState<ConfirmedSite | null>(null);

  const stats = useMemo(
    () => ({
      confirmed: initial.sites.length,
      pending: initial.reports.filter((r) => r.status === "pending").length,
      highRisk: initial.riskCells.filter((c) => c.score >= 0.7).length,
    }),
    [initial]
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Galamsey <span className="text-emerald-400">Eye</span>
          </h1>
          <span className="text-xs text-slate-400">
            Pra River Basin · satellite + community monitoring
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {initial.demoMode && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-300">
              Demo mode — seeded data
            </span>
          )}
          <span className="text-slate-300">
            <b className="text-red-400">{stats.confirmed}</b> confirmed sites
          </span>
          <span className="text-slate-300">
            <b className="text-amber-400">{stats.pending}</b> pending reports
          </span>
          <span className="text-slate-300">
            <b className="text-orange-400">{stats.highRisk}</b> high-risk zones
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-800 bg-slate-950 p-4">
          <LayerControls layers={layers} onChange={setLayers} />
          <Legend />
          <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs leading-relaxed text-slate-400">
            <p className="mb-1 font-medium text-slate-300">Report a site by SMS</p>
            <p>
              Text{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-emerald-300">
                GALAM &lt;town&gt; &lt;what you saw&gt;
              </code>{" "}
              to the short code. No smartphone or data plan needed.
            </p>
          </div>
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
