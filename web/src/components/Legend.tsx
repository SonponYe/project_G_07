export default function Legend() {
  return (
    <section className="rounded-lg border border-ink-700 bg-ink-900 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-600">
        Legend
      </h2>
      <ul className="flex flex-col gap-1.5 text-xs text-neutral-300">
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-red-900 bg-red-600" />
          Confirmed mining site
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-gold-400" />
          Pending community report
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Corroborated community report
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-ink-950 bg-sky-300" />
          Your location
        </li>
        <li className="mt-1 flex items-center gap-2">
          <span
            className="inline-block h-3 w-16 rounded-sm"
            style={{
              background: "linear-gradient(to right, #8a6d21, #d4af37, #e5893a, #dc2626)",
            }}
          />
          Expansion risk (low → high)
        </li>
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        Risk is a transparent weighted score — proximity to existing sites,
        the river network, forest reserves, and terrain accessibility. Hover
        any cell to see its factor breakdown.
      </p>
    </section>
  );
}
