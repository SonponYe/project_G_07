"use client";

import { useEffect } from "react";

import { IconMark } from "@/components/icons";

/**
 * Route-level error boundary. Without this, an uncaught render error in
 * production shows a blank white screen with no way back — this at least
 * gives the user a themed message and a retry, and gets the error into the
 * server console for debugging instead of vanishing silently.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-geo-pattern flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-black/90 p-6 text-center shadow-2xl backdrop-blur sm:p-7">
        <IconMark className="mx-auto mb-3 h-10 w-10 text-gold-500" />
        <p className="text-sm font-semibold text-gold-400">Something went wrong</p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          The dashboard hit an unexpected error. This has been logged — try
          again, or reload the page.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-gold-500 px-4 py-2 text-xs font-semibold text-black hover:bg-gold-400"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-ink-700 px-4 py-2 text-xs text-neutral-300 hover:border-gold-700 hover:text-gold-400"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
