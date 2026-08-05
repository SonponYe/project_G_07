"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { setReportStatus, signOutAction } from "@/app/admin/actions";
import type { Viewer } from "@/lib/auth";
import { exportHighRiskGeoJSON, exportSitesGeoJSON } from "@/lib/export";
import type { ConfirmedSite, DashboardData, LayerVisibility } from "@/lib/types";

import { IconClose, IconMenu } from "./icons";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const isOfficer = viewer?.role === "officer" || viewer?.role === "admin";
  const onAdmin = pathname === "/admin";

  const stats = useMemo(
    () => ({
      confirmed: initial.sites.filter((s) => s.reviewStatus === "published").length,
      pendingReview: initial.sites.filter((s) => s.reviewStatus === "pending_review"),
      pending: initial.reports.filter((r) => r.status === "pending"),
      highRisk: initial.riskCells.filter((c) => c.score >= 0.7).length,
    }),
    [initial]
  );

  function handleReportAction(id: string, status: "confirmed" | "rejected") {
    setReportError(null);
    startTransition(async () => {
      try {
        await setReportStatus(id, status);
        router.refresh();
      } catch (err) {
        setReportError(err instanceof Error ? err.message : "Failed to update — try again.");
      }
    });
  }

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      <header className="flex items-center justify-between gap-2 border-b border-gold-800/40 bg-black px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="-ml-1 shrink-0 rounded-md p-2 text-neutral-300 hover:bg-ink-800 hover:text-gold-400 md:hidden"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
            <h1 className="shrink-0 text-base font-semibold tracking-tight text-gold-400 sm:text-lg">
              Galamsey <span className="text-neutral-100">Eye</span>
            </h1>
            <span className="hidden truncate text-xs text-neutral-500 sm:inline">
              {onAdmin
                ? "Authority Portal · Pra River Basin"
                : "Pra River Basin · satellite + community monitoring"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11px] sm:gap-4 sm:text-xs">
          {initial.demoMode && (
            <span className="hidden rounded-full border border-gold-700/40 bg-gold-950/40 px-2.5 py-1 font-medium text-gold-400 sm:inline">
              Demo mode
            </span>
          )}
          <span className="hidden text-neutral-300 sm:inline">
            <b className="text-red-400">{stats.confirmed}</b> confirmed
          </span>
          <span className="hidden text-neutral-300 md:inline">
            <b className="text-gold-400">{stats.pending.length}</b> pending
          </span>
          <span className="hidden text-neutral-300 md:inline">
            <b className="text-orange-400">{stats.highRisk}</b> high-risk
          </span>
          {isOfficer && stats.pendingReview.length > 0 && (
            <span className="rounded-full border border-gold-600 bg-gold-500/10 px-2 py-0.5 font-medium text-gold-300">
              {stats.pendingReview.length} to review
            </span>
          )}
          {isOfficer ? (
            <>
              <a
                href={onAdmin ? "/" : "/admin"}
                className="rounded-md border border-gold-600 bg-gold-500/10 px-2 py-1 font-medium text-gold-300 hover:bg-gold-500/20 sm:px-2.5"
              >
                <span className="sm:hidden">{onAdmin ? "Public" : "Queue"}</span>
                <span className="hidden sm:inline">
                  {onAdmin ? "Public dashboard" : "Moderation queue"}
                </span>
              </a>
              <form action={signOutAction}>
                <button className="rounded-md border border-ink-700 px-2 py-1 text-neutral-500 hover:border-red-800 hover:text-red-300 sm:px-2.5">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <a
              href="/login"
              className="rounded-md border border-ink-700 px-2 py-1 text-neutral-500 hover:border-gold-700 hover:text-gold-400 sm:px-2.5"
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Officer sign in</span>
            </a>
          )}
        </div>
      </header>

      {/* Mobile stats row — hidden on sm+ where the header shows them inline */}
      <div className="flex items-center gap-3 border-b border-ink-800 bg-ink-950 px-3 py-1.5 text-[11px] text-neutral-400 sm:hidden">
        <span>
          <b className="text-red-400">{stats.confirmed}</b> confirmed
        </span>
        <span>
          <b className="text-gold-400">{stats.pending.length}</b> pending
        </span>
        <span>
          <b className="text-orange-400">{stats.highRisk}</b> high-risk
        </span>
        {initial.demoMode && (
          <span className="ml-auto rounded-full border border-gold-700/40 bg-gold-950/40 px-2 py-0.5 font-medium text-gold-400">
            Demo
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Backdrop — mobile only, closes the drawer on tap-outside */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-[1500] bg-black/70 md:hidden"
            aria-hidden="true"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-[1600] flex w-[85vw] max-w-xs shrink-0 -translate-x-full flex-col gap-4 overflow-y-auto border-r border-ink-800 bg-ink-950 p-4 transition-transform duration-200 ease-out md:static md:z-auto md:w-72 md:max-w-none md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : ""
          }`}
        >
          <div className="flex items-center justify-between md:hidden">
            <span className="text-sm font-semibold text-gold-400">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-2 text-neutral-400 hover:bg-ink-800 hover:text-white"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          {isOfficer && (
            <section className="rounded-lg border border-gold-700/50 bg-gold-950/20 p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-500">
                Pending review ({stats.pendingReview.length + stats.pending.length})
              </h2>

              {stats.pendingReview.length === 0 && stats.pending.length === 0 ? (
                <p className="text-xs text-neutral-500">Queue is clear.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.pendingReview.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-medium text-neutral-400">
                        Detections ({stats.pendingReview.length})
                      </p>
                      {stats.pendingReview.map((site) => (
                        <button
                          key={site.id}
                          onClick={() => {
                            setSelectedSite(site);
                            setSidebarOpen(false);
                          }}
                          className="rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-left text-xs text-gold-200 hover:border-gold-700"
                        >
                          {site.name}
                          {site.areaHa != null ? ` · ${site.areaHa} ha` : ""}
                        </button>
                      ))}
                    </div>
                  )}

                  {stats.pending.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-medium text-neutral-400">
                        Community reports ({stats.pending.length})
                      </p>
                      {stats.pending.map((report) => (
                        <div
                          key={report.id}
                          className="rounded-md border border-ink-700 bg-ink-900 p-2"
                        >
                          <p className="text-xs text-neutral-300">“{report.message}”</p>
                          <p className="mt-0.5 text-[10px] text-neutral-600">
                            {report.locality ?? "unknown locality"}
                          </p>
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              disabled={isPending}
                              onClick={() => handleReportAction(report.id, "confirmed")}
                              className="flex-1 rounded bg-gold-500 px-2 py-1 text-[10px] font-semibold text-black hover:bg-gold-400 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => handleReportAction(report.id, "rejected")}
                              className="flex-1 rounded border border-red-900 px-2 py-1 text-[10px] text-red-300 hover:bg-red-950 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {reportError && <p className="text-xs text-red-400">{reportError}</p>}
                </div>
              )}
            </section>
          )}

          <LayerControls layers={layers} onChange={setLayers} />
          <Legend isOfficer={isOfficer} />

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
              isOfficer={isOfficer}
              onClose={() => setSelectedSite(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
