"use client";

import type { LayerVisibility } from "@/lib/types";

const LAYER_LABELS: Record<keyof LayerVisibility, { label: string; hint: string }> = {
  sites: {
    label: "Confirmed sites",
    hint: "Satellite- or community-verified mining",
  },
  reports: {
    label: "Community reports",
    hint: "SMS reports — gold pending, red confirmed",
  },
  risk: {
    label: "Risk heatmap",
    hint: "Predicted expansion zones, next 60 days",
  },
};

export default function LayerControls({
  layers,
  onChange,
}: {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
}) {
  return (
    <section className="rounded-lg border border-ink-700 bg-ink-900 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-600">
        Map layers
      </h2>
      <div className="flex flex-col gap-2">
        {(Object.keys(LAYER_LABELS) as (keyof LayerVisibility)[]).map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 hover:bg-ink-800"
          >
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => onChange({ ...layers, [key]: !layers[key] })}
              className="mt-0.5 h-4 w-4 accent-gold-500"
            />
            <span>
              <span className="block text-sm text-neutral-200">
                {LAYER_LABELS[key].label}
              </span>
              <span className="block text-xs text-neutral-500">
                {LAYER_LABELS[key].hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
