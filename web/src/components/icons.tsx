/** Minimal line icons, currentColor-based, matching the reticle app mark. */

type IconProps = { className?: string };

export function IconClose({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function IconLocate({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

/** The app mark — a targeting reticle, matching the PWA icon/favicon. Used
 * wherever a page needs a visual anchor beyond the wordmark (login,
 * gate/error states). */
export function IconMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="15.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="20" cy="20" r="8.5" stroke="currentColor" strokeWidth="1" />
      <path
        d="M20 2.5v4M20 33.5v4M2.5 20h4M33.5 20h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.5 4.5L6.5 10l6 5.5" />
    </svg>
  );
}
