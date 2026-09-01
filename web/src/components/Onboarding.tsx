"use client";

import { useEffect, useState } from "react";

import { IconChevronLeft, IconMark } from "./icons";

const STORAGE_KEY = "g07-onboarding-complete";

const STEPS = [
  {
    title: "Welcome to G07",
    body: (
      <>
        Pronounced <b className="text-gold-300">&ldquo;Geo-7&rdquo;</b> — G07
        tracks illegal mining (<i>galamsey</i>) across Ghana&apos;s river
        basins using real satellite data, so damage is caught before it
        spreads, not after.
      </>
    ),
  },
  {
    title: "See confirmed sites",
    body: (
      <>
        Red markers are confirmed mining sites. Click one to see real
        before/after satellite photos with a wipe slider — actual proof of
        what changed, and when.
      </>
    ),
  },
  {
    title: "Predict what's next",
    body: (
      <>
        The heatmap shows where mining is likely to spread in the next 60
        days — a transparent, explainable score based on proximity to
        rivers, existing sites, and forest reserves, not a black box.
      </>
    ),
  },
  {
    title: "Report what you see",
    body: (
      <>
        Notice something suspicious? Text{" "}
        <code className="rounded bg-ink-800 px-1 py-0.5 text-gold-300">
          GALAM &lt;town&gt; &lt;what you saw&gt;
        </code>{" "}
        to the short code — no smartphone or data plan needed. Your report
        helps verify what the satellites find.
      </>
    ),
  },
];

/**
 * First-visit walkthrough. Shown once per browser (localStorage-gated),
 * only on the public dashboard — officers already know the system, so it
 * never appears on /admin.
 */
export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      // Storage unavailable (private mode, blocked) — just skip onboarding
      // rather than risk showing it every visit.
    }
  }, []);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do if storage is blocked — worst case it reappears.
    }
    setVisible(false);
  }

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-black shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-800 p-4">
          <div className="flex items-center gap-2">
            <IconMark className="h-5 w-5 text-gold-500" />
            <span className="text-xs font-medium text-neutral-500">
              {step + 1} of {STEPS.length}
            </span>
          </div>
          <button
            onClick={finish}
            className="text-xs text-neutral-500 hover:text-gold-400"
          >
            Skip
          </button>
        </div>

        <div className="p-6">
          <h2 className="mb-2 text-base font-semibold text-gold-300">
            {STEPS[step].title}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">{STEPS[step].body}</p>
        </div>

        <div className="flex items-center justify-between border-t border-ink-800 p-4">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === step ? "bg-gold-400" : "bg-ink-700"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                aria-label="Previous"
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-neutral-400 hover:text-gold-400"
              >
                <IconChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="rounded-md bg-gold-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-gold-400"
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
