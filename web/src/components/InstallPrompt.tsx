"use client";

import { useEffect, useState } from "react";

import { IconClose } from "./icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "galamsey-eye-install-dismissed";

/**
 * Registers the service worker and shows a custom "install to home screen /
 * PC" banner. Chrome/Edge/Android fire `beforeinstallprompt`, which we
 * capture and defer so we can trigger it from our own button instead of the
 * default mini-infobar. iOS Safari has no such event, so it gets a manual
 * "tap Share → Add to Home Screen" hint instead. Dismissal is remembered in
 * localStorage so this never nags on every visit.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone || alreadyDismissed) return;
    setHidden(false);

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) {
      setShowIosHint(true);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (hidden || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] flex justify-center px-4 pb-4 sm:justify-end sm:pr-4">
      <div className="flex w-full max-w-sm items-start gap-3 rounded-xl border border-[#3a2f12] bg-black/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#e5c158]">Install G07</p>
          {showIosHint ? (
            <p className="mt-1 text-xs text-neutral-400">
              Tap the Share icon, then &ldquo;Add to Home Screen&rdquo; to install this
              app on your device.
            </p>
          ) : (
            <p className="mt-1 text-xs text-neutral-400">
              Add it to your phone or PC for one-tap access, even on a weak connection.
            </p>
          )}
          {!showIosHint && (
            <button
              onClick={handleInstall}
              className="mt-3 rounded-md bg-[#d4af37] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#e5c158]"
            >
              Install
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded-md p-1 text-neutral-500 hover:text-neutral-300"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
