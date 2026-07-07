# Galamsey Eye — Project Breakdown

A file-by-file explanation of the repository. For the problem, architecture rationale, timeline, and demo script, see [README.md](README.md).

```
project_G_07/
├── README.md                     Project overview, architecture, timeline, demo script
├── project_breakdown.md          This file — what every folder and file is for
├── Galamsey_Eye_Project_Doc.docx Original hackathon reference document
├── .gitignore                    Keeps secrets, builds, and dependencies out of git
├── .env.example                  Template for all secrets (never commit real values)
│
├── supabase/                     Database schema & demo data
│   ├── migrations/
│   │   └── 0001_init.sql         Tables, constraints, indexes, Row Level Security
│   └── seed.sql                  Demo dataset for the Pra basin (sites, reports, risk grid)
│
├── pipeline/                     Python data pipeline (Layers 1 & 3)
│   ├── requirements.txt          Python dependencies
│   ├── config.py                 All tunables: basins, dates, thresholds, risk weights
│   ├── detect.py                 Layer 1 — Dynamic World vegetation→bare-ground change
│   ├── water_check.py            NDWI turbidity cross-check over river pixels
│   ├── risk.py                   Layer 3 — transparent weighted risk scoring
│   ├── push.py                   Writes results to Supabase (service role)
│   ├── run_pipeline.py           CLI orchestrator (full run / dry run / risk-only)
│   └── data/
│       ├── pra_river.geojson     Simplified Pra river line for proximity scoring
│       └── forest_reserves.geojson  Placeholder reserve polygons (replace with official data)
│
└── web/                          Next.js 15 dashboard (Layers 2 & 4)
    ├── package.json              Dependencies & scripts (dev / build / typecheck)
    ├── tsconfig.json             TypeScript config (strict mode)
    ├── next.config.ts            Security headers incl. Content-Security-Policy
    ├── postcss.config.mjs        Tailwind CSS v4 wiring
    ├── .env.example              Web-app subset of the env template
    └── src/
        ├── app/
        │   ├── layout.tsx        Root HTML shell + metadata
        │   ├── page.tsx          Server component: fetches data, renders Dashboard
        │   ├── globals.css       Tailwind import + dark theme + Leaflet sizing
        │   └── api/reports/
        │       └── route.ts      Africa's Talking SMS webhook (Layer 2)
        ├── components/
        │   ├── Dashboard.tsx     Client shell: header stats, sidebar, map, panels
        │   ├── MapView.tsx       Leaflet map: sites, reports, risk grid, base layers
        │   ├── LayerControls.tsx Sidebar toggles for the three data layers
        │   ├── Legend.tsx        Marker/heatmap legend + risk-model explainer
        │   └── SitePanel.tsx     Site detail with before/after wipe slider
        └── lib/
            ├── types.ts          Shared TypeScript types for all data models
            ├── data.ts           Supabase reads with fallback to bundled demo data
            ├── sample-data.ts    Known-good demo dataset (mirrors seed.sql)
            └── localities.ts     Pra-basin locality → coordinates for SMS geocoding
```

---

## Root files

| File | Purpose |
|---|---|
| `README.md` | The project reference: problem, pitch, scope, four-layer architecture, tech stack, data sources, team roles, timeline, user flows, risks, stretch goals. |
| `project_breakdown.md` | This document. |
| `Galamsey_Eye_Project_Doc.docx` | The original planning document the build follows. |
| `.gitignore` | Excludes `node_modules`, builds, Python caches, pipeline outputs, and — critically — every `.env` variant and credential file, so secrets can never be committed. |
| `.env.example` | Documents every secret the system needs (Supabase keys, webhook secret, phone-hash key, Earth Engine project). Copy to `.env` / `web/.env.local` and fill in; real files are git-ignored. |

## `supabase/` — database

| File | Purpose |
|---|---|
| `migrations/0001_init.sql` | Creates the three tables from the architecture — `confirmed_sites`, `community_reports`, `risk_scores` — with check constraints (valid coordinates, bounded scores, enumerated statuses), indexes for the dashboard's query patterns, and the security model: RLS enabled everywhere, public roles get SELECT only, and **no write policy exists for public roles**, so only the service role (pipeline + webhook) can write. The `phone_hash` column is additionally revoked from the anon API surface. |
| `seed.sql` | The demo dataset: 5 confirmed sites, 12 community reports, and a 20-cell risk grid along the Pra. Run once after the migration; mirrors `web/src/lib/sample-data.ts` so live mode and demo mode look identical. |

## `pipeline/` — Python data pipeline

Runs periodically (manually during the hackathon), not as a server. Layer numbers refer to the architecture in the README.

| File | Purpose |
|---|---|
| `config.py` | Single source of truth for every tunable: basin bounding boxes (Pra + two backup basins), before/after date windows, Dynamic World class ids, cluster-size threshold, cloud limits, and the documented risk-model weights and decay scales. A judge can read this one file and understand the whole model. |
| `detect.py` | **Layer 1.** Pulls two Dynamic World time slices, flags pixel clusters that flipped vegetation→bare ground, filters noise by connected-cluster size, vectorizes results, and generates before/after Sentinel-2 thumbnail URLs for the dashboard. Uses Google's pretrained model — no training here. |
| `water_check.py` | Independent corroboration: mean NDWI over a 60 m river buffer, before vs after. A negative delta (more turbid water) strengthens a land-cover flag. Returns `None` gracefully when clouds block a window. |
| `risk.py` | **Layer 3.** Scores a ~1.1 km grid with four explainable factors (site proximity, river proximity, reserve proximity, slope accessibility) combined with the weights from `config.py`, plus an optional clamped gold-price multiplier. Stores the per-cell factor breakdown so every score is auditable. |
| `push.py` | The only writer to the database. Uses the service-role key from `.env`; deduplicates sites (~100 m) and replaces the basin's risk grid on each run. |
| `run_pipeline.py` | CLI entry point: `--dry-run` writes GeoJSON to `pipeline/out/` without touching the DB (safe testing), `--skip-detect` refreshes only the risk grid, and slope lookup degrades to a neutral factor if Earth Engine is unreachable — the demo never blocks on a live API. |
| `data/pra_river.geojson` | Simplified Pra main stem + one tributary as line geometry for the river-proximity factor. |
| `data/forest_reserves.geojson` | Placeholder reserve polygons pending official Ghana Forestry Commission shapefiles — clearly labelled as such. |

## `web/` — Next.js dashboard

### Configuration

| File | Purpose |
|---|---|
| `package.json` | Next.js 15, React 19, TypeScript, Tailwind v4, Leaflet, Supabase client, Zod. `npm run dev/build/typecheck`. |
| `tsconfig.json` | Strict TypeScript, `@/*` path alias to `src/`. |
| `next.config.ts` | Security headers on every response: Content-Security-Policy (locked to self + map tiles + Supabase + Earth Engine thumbnails), `X-Frame-Options: DENY`, nosniff, referrer policy, permissions policy, and `poweredByHeader: false`. |
| `postcss.config.mjs` | Tailwind CSS v4 PostCSS plugin. |
| `.env.example` | Web subset of the root env template (copy to `.env.local`). |

### `src/app/` — routes

| File | Purpose |
|---|---|
| `layout.tsx` | Root layout: dark theme, metadata, global CSS. |
| `page.tsx` | Server component. Fetches dashboard data server-side (revalidated every 60 s) and hands it to the client `Dashboard`. |
| `globals.css` | Tailwind import, dark palette variables, Leaflet container sizing. |
| `api/reports/route.ts` | **Layer 2** — the Africa's Talking incoming-SMS webhook. Parses `GALAM <locality> <message>`, geocodes the locality, stores a *pending* report, and auto-upgrades to *confirmed* when a second independent sender reports within ~2 km. Security: constant-time shared-secret check on the callback URL, HMAC-hashed phone numbers (raw numbers never stored), Zod validation with length caps, per-sender rate limiting, fail-closed when unconfigured, and writes only via the server-side service role. |

### `src/components/` — UI

| File | Purpose |
|---|---|
| `Dashboard.tsx` | Client shell: header with live stats (confirmed sites / pending reports / high-risk zones), demo-mode badge, sidebar, and the map. Dynamically imports the map with SSR disabled (Leaflet needs `window`). |
| `MapView.tsx` | The Leaflet map. Renders the risk grid as score-coloured rectangles with factor-breakdown tooltips, community reports as yellow (pending) / red (confirmed) dots with popups (content HTML-escaped), confirmed sites as large red markers that open the site panel, plus Streets/Satellite base-layer switching. |
| `LayerControls.tsx` | Checkbox toggles for the three data layers, with one-line hints. |
| `Legend.tsx` | Colour legend and a plain-language note on how the risk score works. |
| `SitePanel.tsx` | Site detail: the before/after wipe slider (real Sentinel-2 thumbnails when the pipeline has run; labelled placeholders otherwise), the NDWI turbidity corroboration callout, and linked community reports. |

### `src/lib/` — shared logic

| File | Purpose |
|---|---|
| `types.ts` | TypeScript models for sites, reports, risk cells, and layer visibility — the contract between DB rows and UI. |
| `data.ts` | All dashboard reads. Uses only the anon key (read-only under RLS). If env vars are missing **or any fetch fails**, silently falls back to the bundled sample dataset and flags `demoMode` — implementing the doc's "demo must not depend on live internet" rule. |
| `sample-data.ts` | The bundled known-good dataset, kept in sync with `supabase/seed.sql`. |
| `localities.ts` | Small lookup table of Pra-basin towns → coordinates for naive SMS geocoding; unrecognized localities are stored without a map pin rather than rejected. |

---

## Security model (summary)

1. **No public writes.** RLS gives anon/authenticated roles SELECT only; there is no INSERT/UPDATE/DELETE policy. All writes flow through two server-side components (pipeline, webhook) using the service-role key.
2. **Secrets never in git.** `.gitignore` blocks all `.env` files and credentials; `.env.example` documents them without values; the service key is never exposed with a `NEXT_PUBLIC_` prefix.
3. **Reporter privacy.** Phone numbers are HMAC-SHA256-hashed before storage and the hash column is revoked from the public API — a DB leak exposes no phone numbers.
4. **Webhook hardening.** Constant-time secret comparison, Zod schema validation, message length caps, per-sender rate limiting, fail-closed configuration check.
5. **Browser hardening.** Strict Content-Security-Policy, frame-ancestors denial, nosniff, and HTML-escaping of user-supplied report text before it reaches Leaflet popups (XSS defence).
6. **Data integrity.** DB check constraints on coordinates, score bounds, status enums, and message length — invalid rows are impossible even for the service role.

## Running it

```bash
# 1. Database — create a Supabase project, then in the SQL editor run:
#    supabase/migrations/0001_init.sql, then supabase/seed.sql

# 2. Dashboard
cd web
cp .env.example .env.local   # fill in Supabase values (or skip → demo mode)
npm install
npm run dev                  # http://localhost:3000

# 3. Pipeline (optional until Earth Engine access is approved)
cd pipeline
pip install -r requirements.txt
earthengine authenticate
python run_pipeline.py --basin pra --dry-run   # safe test, writes to out/
python run_pipeline.py --basin pra             # full run → Supabase
```

The dashboard works with **zero configuration** — no env vars means demo mode with the bundled Pra-basin dataset, exactly what the judging demo uses.
