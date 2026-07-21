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
