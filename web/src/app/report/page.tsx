"use client";

import { useState } from "react";

import { IconChevronLeft, IconLocate, IconMark } from "@/components/icons";

type Step = "location" | "form" | "sent";

export default function ReportPage() {
  const [step, setStep] = useState<Step>("location");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location isn't supported on this device or browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStep("form");
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. It's required so we can plot your report accurately — see the SMS option below instead."
            : "Couldn't get your location. Check your device's location/GPS is on and try again."
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reports/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong — try again.");
      }
      setStep("sent");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-geo-pattern flex min-h-screen flex-col">
      <header className="flex items-center gap-2 border-b border-ink-800 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-1 text-xs text-neutral-500 hover:text-gold-400">
          <IconChevronLeft className="h-3 w-3" />
          G07
        </a>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-black/90 p-6 shadow-2xl backdrop-blur sm:p-7">
          {step === "location" && (
            <div className="text-center">
              <IconMark className="mx-auto mb-3 h-10 w-10 text-gold-500" />
              <h1 className="text-lg font-semibold text-gold-300">Report a site</h1>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                Sharing your location is required so your report can be
                plotted accurately on the map. Your exact identity is never
                stored — only a one-way hash used to prevent spam.
              </p>
              <button
                onClick={requestLocation}
                disabled={locating}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-gold-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-400 disabled:opacity-50"
              >
                <IconLocate className="h-4 w-4" />
                {locating ? "Getting your location…" : "Share my location to continue"}
              </button>
              {locationError && (
                <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 p-2.5 text-left text-xs text-red-300">
                  {locationError}
                </p>
              )}
              <p className="mt-4 text-[11px] text-neutral-600">
                Can&apos;t share your location? Text{" "}
                <code className="rounded bg-ink-800 px-1 py-0.5 text-gold-400">
                  GALAM &lt;town&gt; &lt;what you saw&gt;
                </code>{" "}
                instead — no smartphone or data plan needed.
              </p>
            </div>
          )}

          {step === "form" && coords && (
            <form onSubmit={handleSubmit}>
              <h1 className="text-lg font-semibold text-gold-300">What did you see?</h1>
              <p className="mt-1 text-xs text-neutral-500">
                Location captured: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
              <textarea
                required
                minLength={1}
                maxLength={500}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Excavator and pumping equipment moved into the forest near the river yesterday evening"
                className="mt-4 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-gold-500"
              />
              {submitError && (
                <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 p-2.5 text-xs text-red-300">
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full rounded-md bg-gold-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-400 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Submit report"}
              </button>
            </form>
          )}

          {step === "sent" && (
            <div className="text-center">
              <IconMark className="mx-auto mb-3 h-10 w-10 text-gold-500" />
              <h1 className="text-lg font-semibold text-gold-300">Report received</h1>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                Thank you — an officer will review it. It'll appear on the
                public map once verified, or sooner if satellite data or
                another nearby report already corroborates it.
              </p>
              <a
                href="/map"
                className="mt-5 inline-block rounded-md border border-gold-700 px-4 py-2 text-xs font-medium text-gold-300 hover:bg-gold-950/40"
              >
                View the live map
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
