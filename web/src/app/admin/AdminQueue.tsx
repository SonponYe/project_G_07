"use client";

import { useTransition } from "react";

import { IconChevronLeft } from "@/components/icons";

import { setReportStatus, setSiteReview, signOutAction } from "./actions";

interface PendingSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  areaHa: number | null;
  detectionSource: string;
  waterCorroborated: boolean;
  detectedAt: string;
}

interface PendingReport {
  id: string;
  message: string;
  locality: string | null;
  createdAt: string;
}

export default function AdminQueue({
  viewerEmail,
  sites,
  reports,
}: {
  viewerEmail: string;
  sites: PendingSite[];
  reports: PendingReport[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">
            Authority Portal
          </p>
          <h1 className="text-xl font-semibold text-gold-300">Moderation queue</h1>
          <p className="text-xs text-neutral-500">Signed in as {viewerEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-gold-400"
          >
            <IconChevronLeft className="h-3 w-3" />
            Public dashboard
          </a>
          <form action={signOutAction}>
            <button className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-gold-700 hover:text-gold-300">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          New detections awaiting review ({sites.length})
        </h2>
        {sites.length === 0 ? (
          <p className="text-sm text-neutral-600">Nothing pending — queue is clear.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sites.map((site) => (
              <li
                key={site.id}
                className="rounded-lg border border-ink-700 bg-ink-900 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-100">{site.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {site.lat.toFixed(4)}, {site.lng.toFixed(4)} ·{" "}
                      {site.areaHa != null ? `${site.areaHa} ha · ` : ""}
                      source: {site.detectionSource} ·{" "}
                      {site.waterCorroborated
                        ? "NDWI corroborated"
                        : "no water corroboration"}
                    </p>
                    <p className="text-xs text-neutral-600">
                      Detected {new Date(site.detectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() => setSiteReview(site.id, "published"))
                      }
                      className="flex-1 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-400 disabled:opacity-50 sm:flex-none"
                    >
                      Publish
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() => setSiteReview(site.id, "rejected"))
                      }
                      className="flex-1 rounded-md border border-red-900 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950 sm:flex-none"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Pending community reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-neutral-600">Nothing pending.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => (
              <li
                key={report.id}
                className="rounded-lg border border-ink-700 bg-ink-900 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200">“{report.message}”</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {report.locality ?? "unknown locality"} ·{" "}
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() => setReportStatus(report.id, "confirmed"))
                      }
                      className="flex-1 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-400 disabled:opacity-50 sm:flex-none"
                    >
                      Confirm
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() => setReportStatus(report.id, "rejected"))
                      }
                      className="flex-1 rounded-md border border-red-900 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950 sm:flex-none"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
