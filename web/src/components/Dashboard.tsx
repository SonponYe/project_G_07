"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { requestPipelineRun, setReportStatus, signOutAction } from "@/app/admin/actions";
import type { Viewer } from "@/lib/auth";
import { BASINS } from "@/lib/basins";
import { exportHighRiskGeoJSON, exportSitesGeoJSON } from "@/lib/export";
import type {
  ConfirmedSite,
  DashboardData,
  LayerVisibility,
  PipelineRun,
} from "@/lib/types";

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

type SidebarTab = "queue" | "scan" | "layers";

const RUN_STATUS_STYLE: Record<PipelineRun["status"], string> = {
  queued: "border-neutral-600 text-neutral-400",
  running: "border-gold-600 text-gold-400",
  done: "border-emerald-700 text-emerald-400",
  failed: "border-red-800 text-red-400",
};

export default function Dashboard({
  initial,
  viewer,
  pipelineRuns,
}: {
  initial: DashboardData;
  viewer: Viewer | null;
  /** Only ever provided on /admin — its presence is what gates the Scan
   * tab, since a request only makes sense where an officer is looking. */
  pipelineRuns?: PipelineRun[];
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

  // ── Scan (officer-requested targeted pipeline run) ──────────────────────
  const [pickMode, setPickMode] = useState(false);
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusM, setRadiusM] = useState("2000");
  const [scanBasin, setScanBasin] = useState<string>(BASINS[0].key);
  const [scanLabel, setScanLabel] = useState("");
  const [scanNotes, setScanNotes] = useState("");
  const [scanReportId, setScanReportId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);

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

  function handlePickPoint(lat: number, lng: number) {
    setCenterLat(lat.toFixed(5));
    setCenterLng(lng.toFixed(5));
    setPickMode(false);
  }

  /** Most map apps (Google Maps included) give you one copyable string like
   * "5.6410, -1.5490" rather than two separate numbers — accept that
   * directly instead of forcing a split into two fields by hand. */
  function handlePasteCoords(value: string) {
    const match = value.match(/(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)/);
    if (!match) return;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    setCenterLat(lat.toFixed(5));
    setCenterLng(lng.toFixed(5));
  }

  function handleSelectReport(reportId: string) {
    setScanReportId(reportId || null);
    if (!reportId) return;
    const report = initial.reports.find((r) => r.id === reportId);
    if (report?.lat != null && report?.lng != null) {
      setCenterLat(report.lat.toFixed(5));
      setCenterLng(report.lng.toFixed(5));
    }
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScanError(null);
    setScanSuccess(false);

    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const radius = parseInt(radiusM, 10);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setScanError("Enter a valid latitude and longitude, or pick a point on the map.");
      return;
    }
    if (Number.isNaN(radius) || radius < 100 || radius > 20000) {
      setScanError("Radius must be between 100 and 20,000 metres.");
      return;
    }

    setScanSubmitting(true);
    try {
      await requestPipelineRun({
        centerLat: lat,
        centerLng: lng,
        radiusM: radius,
        basin: scanBasin,
        label: scanLabel,
        notes: scanNotes,
        reportId: scanReportId,
      });
      setScanSuccess(true);
      setCenterLat("");
      setCenterLng("");
      setScanLabel("");
      setScanNotes("");
      setScanReportId(null);
      router.refresh();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to submit — try again.");
    } finally {
      setScanSubmitting(false);
    }
  }

  const pickedPoint =
    centerLat && centerLng && !Number.isNaN(parseFloat(centerLat)) && !Number.isNaN(parseFloat(centerLng))
      ? { lat: parseFloat(centerLat), lng: parseFloat(centerLng) }
      : null;

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
                ? "Authority Portal · Ghana's river basins"
                : "Ghana's river basins · satellite + community monitoring"}
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
                href={onAdmin ? "/map" : "/admin"}
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
                {pipelineRuns !== undefined && (
                  <button
                    onClick={() => setTab("scan")}
                    className={`rounded-t-md px-3 py-2 text-xs font-medium ${
                      tab === "scan"
                        ? "border-b-2 border-gold-500 text-gold-300"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Scan
                  </button>
                )}
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
                {tab === "queue" && (
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
                )}

                {tab === "scan" && pipelineRuns !== undefined && (
                  <>
                    <form onSubmit={handleScanSubmit} className="flex flex-col gap-3">
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-neutral-400">
                          Center point
                        </p>
                        <button
                          type="button"
                          onClick={() => setPickMode((v) => !v)}
                          className={`w-full rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                            pickMode
                              ? "border-gold-500 bg-gold-500/10 text-gold-300"
                              : "border-ink-700 text-neutral-300 hover:border-gold-700"
                          }`}
                        >
                          {pickMode ? "Click the map…" : "Pick on map"}
                        </button>
                        <input
                          type="text"
                          placeholder="Or paste coordinates, e.g. 5.6410, -1.5490"
                          onChange={(e) => handlePasteCoords(e.target.value)}
                          className="mt-2 w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-gold-500"
                        />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="any"
                            required
                            placeholder="Latitude"
                            value={centerLat}
                            onChange={(e) => setCenterLat(e.target.value)}
                            className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                          />
                          <input
                            type="number"
                            step="any"
                            required
                            placeholder="Longitude"
                            value={centerLng}
                            onChange={(e) => setCenterLng(e.target.value)}
                            className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                          />
                        </div>
                      </div>

                      {initial.reports.filter((r) => r.status === "pending" && r.lat != null).length >
                        0 && (
                        <label className="flex flex-col gap-1 text-[11px] text-neutral-400">
                          Or link to a pending report
                          <select
                            value={scanReportId ?? ""}
                            onChange={(e) => handleSelectReport(e.target.value)}
                            className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                          >
                            <option value="">None</option>
                            {initial.reports
                              .filter((r) => r.status === "pending" && r.lat != null)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.locality ?? "unknown"} — {r.message.slice(0, 40)}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}

                      <label className="flex flex-col gap-1 text-[11px] text-neutral-400">
                        Basin
                        <select
                          value={scanBasin}
                          onChange={(e) => setScanBasin(e.target.value)}
                          className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                        >
                          {BASINS.map((b) => (
                            <option key={b.key} value={b.key}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-neutral-600">
                          Picks which basin&apos;s river/reserve data scores the scan — only Pra has real reference data run so far.
                        </span>
                      </label>

                      <label className="flex flex-col gap-1 text-[11px] text-neutral-400">
                        Radius (metres, 100–20,000)
                        <input
                          type="number"
                          min={100}
                          max={20000}
                          required
                          value={radiusM}
                          onChange={(e) => setRadiusM(e.target.value)}
                          className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-[11px] text-neutral-400">
                        Label (optional)
                        <input
                          type="text"
                          maxLength={120}
                          placeholder="e.g. Daboase tip-off"
                          value={scanLabel}
                          onChange={(e) => setScanLabel(e.target.value)}
                          className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-[11px] text-neutral-400">
                        Notes (optional)
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={scanNotes}
                          onChange={(e) => setScanNotes(e.target.value)}
                          className="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-gold-500"
                        />
                      </label>

                      {scanError && <p className="text-xs text-red-400">{scanError}</p>}
                      {scanSuccess && (
                        <p className="text-xs text-emerald-400">
                          Scan requested — it'll run next time the pipeline drains the queue.
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={scanSubmitting}
                        className="rounded-md bg-gold-500 px-3 py-2 text-xs font-semibold text-black hover:bg-gold-400 disabled:opacity-50"
                      >
                        {scanSubmitting ? "Requesting…" : "Request scan"}
                      </button>
                    </form>

                    {pipelineRuns.length > 0 && (
                      <section>
                        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                          Past requests
                        </h2>
                        <div className="flex flex-col gap-2">
                          {pipelineRuns.map((run) => (
                            <div
                              key={run.id}
                              className="rounded-md border border-ink-700 bg-ink-900 p-2.5 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-neutral-200">
                                  {run.label || `${run.centerLat.toFixed(3)}, ${run.centerLng.toFixed(3)}`}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${RUN_STATUS_STYLE[run.status]}`}
                                >
                                  {run.status}
                                </span>
                              </div>
                              <p className="mt-1 text-[10px] text-neutral-600">
                                {(run.radiusM / 1000).toFixed(1)}km radius
                                {run.sitesFound != null ? ` · ${run.sitesFound} site(s) found` : ""}
                                {run.errorMessage ? ` · ${run.errorMessage}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {tab === "layers" && (
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
            pickMode={tab === "scan" && pickMode}
            onPickPoint={handlePickPoint}
            pickedPoint={tab === "scan" ? pickedPoint : null}
            pickedRadiusM={tab === "scan" ? parseInt(radiusM, 10) || undefined : undefined}
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
