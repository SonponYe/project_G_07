"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { setReportStatus, signOutAction } from "@/app/admin/actions";
import type { Viewer } from "@/lib/auth";
import { exportHighRiskGeoJSON, exportSitesGeoJSON } from "@/lib/export";
import type { ConfirmedSite, DashboardData, LayerVisibility } from "@/lib/types";

import { IconClose, IconMark, IconMenu } from "./icons";
import LayerControls from "./LayerControls";
import Legend from "./Legend";
import Onboarding from "./Onboarding";
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

type SidebarTab = "queue" | "layers";

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
  const [tab, setTab] = useState<SidebarTab>("queue");

  const stats = useMemo(
    () => ({
      confirmed: initial.sites.filter((s) => s.reviewStatus === "published").length,
      pendingReview: initial.sites.filter((s) => s.reviewStatus === "pending_review"),
      pending: initial.reports.filter((r) => r.status === "pending"),
      highRisk: initial.riskCells.filter((c) => c.score >= 0.7).length,
    }),
    [initial]
  );
  const totalToReview = stats.pendingReview.length + stats.pending.length;

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

  function openQueueSite(site: ConfirmedSite) {
    setSelectedSite(site);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      {!onAdmin && <Onboarding />}
      {onAdmin && (
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700" />
      )}

      <header className="flex items-center justify-between gap-2 border-b border-gold-800/40 bg-black px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="-ml-1 shrink-0 rounded-md p-2 text-neutral-300 hover:bg-ink-800 hover:text-gold-400 md:hidden"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <IconMark className="hidden h-6 w-6 shrink-0 text-gold-500 sm:block" />
          <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
            <h1 className="shrink-0 text-base font-semibold tracking-tight text-gold-400 sm:text-lg">
              G07
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

      {/* Officer review banner — the single most important call-to-action
          on this page, so it gets its own full-width strip rather than
          being buried in a stat pill. */}
      {onAdmin && totalToReview > 0 && (
        <button
          onClick={() => {
            setTab("queue");
            setSidebarOpen(true);
          }}
          className="flex items-center gap-2 border-b border-gold-700/50 bg-gold-950/30 px-3 py-2 text-left text-xs text-gold-300 hover:bg-gold-950/50 sm:px-5"
        >
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
          <span className="min-w-0 flex-1 truncate">
            <b>{totalToReview}</b> item{totalToReview === 1 ? "" : "s"} awaiting your review
          </span>
          <span className="hidden shrink-0 underline underline-offset-2 md:inline">
            Open queue
          </span>
        </button>
      )}

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
          className={`fixed inset-y-0 left-0 z-[1600] flex w-[85vw] max-w-xs shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-ink-800 bg-ink-950 transition-transform duration-200 ease-out md:static md:z-auto md:max-w-none md:translate-x-0 ${
            isOfficer ? "md:w-80" : "md:w-72"
          } ${sidebarOpen ? "translate-x-0" : ""}`}
        >
          <div className="flex items-center justify-between p-4 pb-0 md:hidden">
            <span className="text-sm font-semibold text-gold-400">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-2 text-neutral-400 hover:bg-ink-800 hover:text-white"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          {isOfficer ? (
            <>
              {/* Tabs */}
              <div className="flex gap-1 border-b border-ink-800 px-4 pt-4">
                <button
                  onClick={() => setTab("queue")}
                  className={`rounded-t-md px-3 py-2 text-xs font-medium ${
                    tab === "queue"
                      ? "border-b-2 border-gold-500 text-gold-300"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  Queue{totalToReview > 0 ? ` (${totalToReview})` : ""}
                </button>
                <button
                  onClick={() => setTab("layers")}
                  className={`rounded-t-md px-3 py-2 text-xs font-medium ${
                    tab === "layers"
                      ? "border-b-2 border-gold-500 text-gold-300"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  Map layers
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                {tab === "queue" ? (
                  <>
                    {totalToReview === 0 ? (
                      <p className="text-xs text-neutral-500">
                        Queue is clear — nothing awaiting review.
                      </p>
                    ) : (
                      <>
                        {stats.pendingReview.length > 0 && (
                          <section>
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                              Detections ({stats.pendingReview.length})
                            </h2>
                            <div className="flex flex-col gap-2">
                              {stats.pendingReview.map((site) => (
                                <button
                                  key={site.id}
                                  onClick={() => openQueueSite(site)}
                                  className="flex items-center gap-2.5 rounded-md border border-ink-700 bg-ink-900 p-2 text-left hover:border-gold-700"
                                >
                                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded bg-ink-800">
                                    {site.beforeImageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={site.beforeImageUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-600">
                                        No photo
                                      </span>
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs text-gold-200">
                                      {site.name}
                                    </span>
                                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-neutral-500">
                                      {site.areaHa != null ? `${site.areaHa} ha` : "area n/a"}
                                      {site.waterCorroborated && (
                                        <span className="flex items-center gap-1 text-sky-400">
                                          <span className="h-1 w-1 rounded-full bg-sky-400" />
                                          NDWI
                                        </span>
                                      )}
                                    </span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </section>
                        )}

                        {stats.pending.length > 0 && (
                          <section>
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                              Community reports ({stats.pending.length})
                            </h2>
                            <div className="flex flex-col gap-2">
                              {stats.pending.map((report) => (
                                <div
                                  key={report.id}
                                  className="rounded-md border border-ink-700 bg-ink-900 p-2.5"
                                >
                                  <p className="text-xs text-neutral-300">“{report.message}”</p>
                                  <p className="mt-0.5 text-[10px] text-neutral-600">
                                    {report.locality ?? "unknown locality"}
                                  </p>
                                  <div className="mt-2 flex gap-1.5">
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
                          </section>
                        )}
                        {reportError && <p className="text-xs text-red-400">{reportError}</p>}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <LayerControls layers={layers} onChange={setLayers} />
                    <Legend isOfficer={isOfficer} />
                  </>
                )}

                <section className="mt-auto rounded-lg border border-gold-700/50 bg-gold-950/20 p-3">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-500">
                    Export
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
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-4 p-4">
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
            </div>
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
