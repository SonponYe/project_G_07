/** Mirrors pipeline/config.py's BASINS keys/names — kept here too since the
 * Python config isn't importable into the frontend. Used by the officer
 * Scan form so a targeted run isn't locked to one basin. */
export const BASINS = [
  { key: "pra", name: "Pra River Basin" },
  { key: "ankobra", name: "Ankobra River Basin" },
  { key: "offin", name: "Offin River Basin" },
] as const;

export type BasinKey = (typeof BASINS)[number]["key"];
