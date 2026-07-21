"use client";

import { useState } from "react";

import type { CommunityReport, ConfirmedSite } from "@/lib/types";

import { IconClose } from "./icons";

/**
 * Site detail panel with the before/after reveal — the key visual moment
 * of the demo. When Earth Engine thumbnails exist they're shown with a
 * wipe slider; otherwise labelled placeholders keep the flow demoable.
 */
export default function SitePanel({
  site,
  reports,
  onClose,
}: {
  site: ConfirmedSite;
  reports: CommunityReport[];
  onClose: () => void;
}) {
  const [wipe, setWipe] = useState(50);
  const hasImagery = Boolean(site.beforeImageUrl && site.afterImageUrl);

  return (
    <div className="absolute right-4 top-4 z-[1000] w-96 max-w-[calc(100%-2rem)] rounded-xl border border-ink-700 bg-black/95 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between border-b border-ink-700 p-4">
        <div>
          <h3 className="font-semibold text-gold-300">{site.name}</h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            Detected {new Date(site.detectedAt).toLocaleDateString()} ·{" "}
            {site.areaHa != null ? `${site.areaHa} ha · ` : ""}
            source: {site.detectionSource}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close site panel"
          className="rounded-md p-1.5 text-neutral-400 hover:bg-ink-800 hover:text-white"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-600">
          Before / after (~3 months)
        </p>

        <div className="relative h-48 overflow-hidden rounded-lg border border-ink-700">
          {hasImagery ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={site.beforeImageUrl!}
                alt="Before — Sentinel-2"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={site.afterImageUrl!}
                  alt="After — Sentinel-2"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 30% 40%, #14532d, #166534 45%, #15803d 75%)",
                }}
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 60% 50%, #a16207, #854d0e 40%, #713f12 80%)",
                  }}
                />
              </div>
              <span className="absolute bottom-1.5 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-emerald-200">
                BEFORE · vegetation
              </span>
              <span className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-gold-300">
                AFTER · bare ground
              </span>
            </>
          )}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-gold-400/80"
            style={{ left: `${wipe}%` }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={wipe}
          onChange={(e) => setWipe(Number(e.target.value))}
          aria-label="Before/after comparison slider"
          className="mt-2 w-full accent-gold-500"
        />
        {!hasImagery && (
          <p className="mt-1 text-[11px] text-neutral-500">
            Illustrative placeholder — Sentinel-2 thumbnails attach here once
            the pipeline runs against Earth Engine.
          </p>
        )}

        {site.ndwiDrop != null && (
          <p
            className={
              site.waterCorroborated
                ? "mt-3 rounded-md border border-gold-800 bg-gold-950/40 p-2.5 text-xs text-gold-300"
                : "mt-3 rounded-md border border-ink-700 bg-ink-900 p-2.5 text-xs text-neutral-400"
            }
          >
            Water turbidity check: NDWI changed{" "}
            <b>{site.ndwiDrop.toFixed(2)}</b> over nearby river pixels.{" "}
            {site.waterCorroborated
              ? "Past the noise threshold — independent corroboration of the land-cover change."
              : "Within normal noise — not treated as corroboration."}
          </p>
        )}

        {site.officerNotes && (
          <p className="mt-3 rounded-md border border-ink-700 bg-ink-900 p-2.5 text-xs text-neutral-300">
            <span className="font-medium text-gold-500">Officer note:</span>{" "}
            {site.officerNotes}
          </p>
        )}

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-gold-600">
          Linked community reports ({reports.length})
        </p>
        {reports.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No community reports linked to this site yet.
          </p>
        ) : (
          <ul className="flex max-h-32 flex-col gap-2 overflow-y-auto">
            {reports.map((report) => (
              <li
                key={report.id}
                className="rounded-md border border-ink-700 bg-ink-900 p-2 text-xs text-neutral-300"
              >
                “{report.message}”
                <span className="mt-1 block text-[10px] text-neutral-500">
                  {report.locality} ·{" "}
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
