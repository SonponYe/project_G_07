"use client";

import { useEffect } from "react";

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 px-4 text-center">
      <p className="text-sm font-semibold text-gold-400">Something went wrong</p>
      <p className="max-w-sm text-xs text-neutral-500">
        The dashboard hit an unexpected error. This has been logged — try
        again, or reload the page.
      </p>
      <div className="flex gap-2">
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
  );
}
