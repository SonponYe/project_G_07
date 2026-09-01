import { IconMark } from "./icons";

/** Shared "you can't be here" / status card for auth gates — consistent
 * with the login page's visual identity instead of bare centered text. */
export default function GateMessage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="bg-geo-pattern flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-black/90 p-6 text-center shadow-2xl backdrop-blur sm:p-7">
        <IconMark className="mx-auto mb-3 h-10 w-10 text-gold-500" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">
          Authority Portal
        </p>
        <h1 className="mt-1 text-base font-semibold text-gold-300">{title}</h1>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">{message}</p>
        {action && (
          <a
            href={action.href}
            className="mt-5 inline-block rounded-md border border-gold-700 px-4 py-2 text-xs font-medium text-gold-300 hover:bg-gold-950/40"
          >
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}
