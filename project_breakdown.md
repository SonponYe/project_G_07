# G07 — Project Breakdown

A file-by-file explanation of the repository. For the problem, architecture, and current live status, see [README.md](README.md).

```
project_G_07/
├── README.md                     Project overview, architecture, status, deployment
├── project_breakdown.md          This file — what every folder and file is for
├── Galamsey_Eye_Project_Doc.docx Original hackathon reference document
├── .gitignore                    Keeps secrets, builds, and dependencies out of git
├── .env.example                  Template for all secrets (never commit real values)
│
├── supabase/                     Database schema & demo data
│   ├── migrations/
│   │   ├── 0001_init.sql         Core tables, constraints, indexes, Row Level Security
│   │   ├── 0002_roles_and_moderation.sql  Officer roles + moderation queue on top of 0001
│   │   └── 0003_pipeline_runs.sql  Officer-requested targeted-scan queue
│   └── seed.sql                  Demo dataset for the Pra basin (sites, reports, risk grid)
│
├── pipeline/                     Python data pipeline (Layers 1, 2, 4 & 6)
│   ├── requirements.txt          Python dependencies
│   ├── config.py                 All tunables: basins, dates, thresholds, risk weights, bbox-from-radius helper
│   ├── detect.py                 Layer 1 — Dynamic World vegetation→bare-ground change (whole basin or a bbox override)
│   ├── water_check.py            Layer 2 — NDWI turbidity cross-check over river pixels
│   ├── risk.py                   Layer 4 — transparent weighted risk scoring
│   ├── push.py                   Writes results to Supabase (service role) + pipeline_runs queue helpers
│   ├── run_pipeline.py           CLI orchestrator (full run / dry run / risk-only / --from-queue)
│   ├── check_sites.py            Diagnostic: NDWI coverage stats, flags likely-duplicate sites
│   ├── test_ndwi.py              Diagnostic: tune cloud/date settings without re-running detection
│   └── data/
│       ├── pra_river.geojson     Simplified Pra river line for proximity scoring
│       └── forest_reserves.geojson  Placeholder reserve polygons (replace with official data)
│
└── web/                          Next.js 15 app (Layers 3 & 5, three surfaces: landing, public map, authority)
    ├── package.json              Dependencies & scripts (dev / build / typecheck)
    ├── tsconfig.json             TypeScript config (strict mode)
    ├── next.config.ts            Security headers incl. Content-Security-Policy
    ├── postcss.config.mjs        Tailwind CSS v4 wiring
    ├── .env.example              Web-app subset of the env template
    ├── public/
    │   ├── manifest.json         PWA manifest (name, icons, standalone display, start_url=/map)
    │   ├── sw.js                 Service worker — offline app-shell caching
    │   ├── apple-touch-icon.png  iOS home-screen icon
    │   └── icons/                Full PWA icon set (16/32/192/512px)
    └── src/
        ├── middleware.ts         Refreshes the Supabase auth session cookie on every request
        ├── app/
        │   ├── layout.tsx        Root HTML shell, PWA metadata, mounts InstallPrompt
        │   ├── page.tsx          The landing page (public front door) — no login, no map dependency
        │   ├── map/
        │   │   └── page.tsx      The interactive dashboard — what used to live at "/"
        │   ├── report/
        │   │   └── page.tsx      Public web report form — mandatory geolocation, no SMS needed
        │   ├── globals.css       Tailwind import, black/gold theme tokens, Leaflet sizing, geo-pattern background
        │   ├── favicon.ico       Browser tab icon
        │   ├── error.tsx         Themed global error boundary
        │   ├── login/
        │   │   └── page.tsx      Officer sign-in (no public self-signup)
        │   ├── admin/
        │   │   ├── page.tsx      Server component: gates on officer role, renders the shared Dashboard with officer-scoped data + pipeline_runs
        │   │   └── actions.ts    Server actions — run under the signed-in officer's own session
        │   └── api/reports/
        │       ├── route.ts      httpsms SMS webhook (Layer 3)
        │       └── web/route.ts  Web report form submission — same corroboration logic, no SMS involved
        ├── components/
        │   ├── Dashboard.tsx     Client shell: header, retractable mobile drawer, sidebar tabs (Queue/Scan/Layers), map
        │   ├── MapView.tsx       Leaflet map: sites, reports, risk grid, base layers, geolocation, pick-a-point mode
        │   ├── LayerControls.tsx Sidebar toggles for the three data layers
        │   ├── Legend.tsx        Marker/heatmap legend + risk-model explainer
        │   ├── SitePanel.tsx     Site detail — before/after wipe slider, bottom sheet on mobile
        │   ├── InstallPrompt.tsx PWA install banner (native prompt capture + iOS fallback)
        │   ├── Onboarding.tsx    First-visit walkthrough modal (public dashboard only)
        │   ├── GateMessage.tsx   Shared "not configured" / "access restricted" card
        │   └── icons.tsx         Shared minimal line-icon set (close, locate, menu, chevron, mark)
        └── lib/
            ├── types.ts          Shared TypeScript types for all data models, incl. PipelineRun
            ├── data.ts           Supabase reads (public, officer-scoped, and pipeline_runs) with demo-data fallback
            ├── sample-data.ts    Known-good demo dataset (mirrors seed.sql)
            ├── localities.ts     Pra-basin locality → coordinates for SMS geocoding
            ├── geo.ts            Haversine distance + nearest-point helper (geolocation feature)
            ├── export.ts         Client-side GeoJSON export (officer "Export" panel)
            ├── auth.ts           getViewer() — current user + role, or null
            ├── reportIngest.ts   Shared hashing/rate-limiting/corroboration logic (both report routes)
            └── supabase/
                ├── server.ts     Server Component / Server Action Supabase client
                └── client.ts     Browser Supabase client (used by the login form)
```

---

## Root files

| File | Purpose |
|---|---|
| `README.md` | The project reference: problem, pitch, six-layer architecture, three-surface UX, PWA/mobile notes, tech stack, data model, security model, deployment. |
| `project_breakdown.md` | This document. |
| `Galamsey_Eye_Project_Doc.docx` | The original hackathon planning document the build started from. |
| `.gitignore` | Excludes `node_modules`, builds, Python caches, pipeline outputs, and — critically — every `.env` variant and credential file, so secrets can never be committed. |
| `.env.example` | Documents every secret the system needs (Supabase keys, webhook secret, phone-hash key, Earth Engine project). Copy to `.env` / `web/.env.local` and fill in; real files are git-ignored. |

## `supabase/` — database

| File | Purpose |
|---|---|
| `migrations/0001_init.sql` | Creates `confirmed_sites`, `community_reports`, `risk_scores` with check constraints, indexes, and baseline RLS: public roles get SELECT only, no write policy exists for them. `phone_hash` is additionally revoked from the anon API surface. |
| `migrations/0002_roles_and_moderation.sql` | Adds `profiles` (officer/admin roles tied to Supabase Auth users), a `SECURITY DEFINER` `is_officer()` helper, `review_status`/`officer_notes` columns on `confirmed_sites`, and narrows the public read policy to `review_status = 'published'` only. Officers get a **column-scoped** UPDATE grant — never full table access — enforced by Postgres, not the app. |
| `migrations/0003_pipeline_runs.sql` | Adds `pipeline_runs` (an officer-requested scan: center point, radius, status, results) and `confirmed_sites.pipeline_run_id` for traceability. Officers can read all runs and insert their own; only the service role (the pipeline draining the queue) updates status/results — an officer can request a scan, not fake its outcome. |
| `seed.sql` | Demo dataset: 5 confirmed sites, 12 community reports, a risk grid. Mirrors `web/src/lib/sample-data.ts` so live mode and demo mode look identical when the pipeline hasn't been run. |

## `pipeline/` — Python data pipeline

Runs as a one-off/periodic script, not a server — it writes to Supabase and exits. The dashboard never depends on it being "up."

| File | Purpose |
|---|---|
| `config.py` | Single source of truth for every tunable: basin bounding boxes, date windows, Dynamic World class ids, cluster-size threshold, cloud limits (tuned to 50% after real-world testing), NDWI noise threshold, risk-model weights, and `bbox_from_center(lat, lng, radius_m)` — turns an officer's point + radius into a bounding box, correcting for longitude degrees shrinking with latitude. |
| `detect.py` | **Layer 1.** Pulls two Dynamic World time slices over a region, flags vegetation→bare-ground clusters, filters noise, vectorizes results, and downloads real before/after Sentinel-2 thumbnails as bytes. `detect_change(basin_key, bbox=None)` — an explicit `bbox` scans a small officer-requested area instead of the whole named basin; `basin_key` still tags results and picks which basin's reference data scores them. |
| `water_check.py` | **Layer 2.** Mean NDWI over a 60 m river buffer, before vs. after. Catches Earth Engine's "empty composite" exception when clouds block a window for a given site. |
| `risk.py` | **Layer 4.** Scores a ~1.1 km grid with four explainable factors, plus a clamped gold-price multiplier. Cell IDs are built from exact integer grid indices, not formatted floats — a fixed bug where every cell sat exactly on a `.2f` rounding boundary caused duplicate-ID collisions. |
| `push.py` | The only writer to the database. Deduplicates sites (~100 m, scoped per basin), uploads before/after images to Supabase Storage, marks new detections `review_status = 'pending_review'`, and (when given one) tags a site with the `pipeline_run_id` that found it. Replaces a basin's risk grid via delete-then-insert. Also holds the **pipeline_runs queue helpers**: `get_queued_runs`, `mark_run_running`, `mark_run_done`, `mark_run_failed` — all service-role, all using real computed timestamps (a literal `"now()"` string would just be stored as text, not evaluated, since it goes through the REST API as data). |
| `run_pipeline.py` | CLI entry point. `--dry-run` writes GeoJSON + images to `pipeline/out/` without touching the DB. `--skip-detect` refreshes only the whole-basin risk grid. `--limit N` caps sites processed. `--from-queue` drains officer-requested scans (see Layer 6 in the README) — detection + water-check only, tagged with `pipeline_run_id`; **deliberately never touches risk_scores**, since replacing a basin's entire grid from a tiny-radius run's handful of cells would delete the real one. Forces UTF-8 stdout so progress messages don't crash on Windows when output is redirected. |
| `check_sites.py` | Standalone diagnostic — NDWI coverage % and near-duplicate flagging against a dry-run's output. |
| `test_ndwi.py` | Standalone diagnostic — replay the water-check step with different settings without re-running detection. |
| `data/pra_river.geojson` | Simplified Pra main stem + one tributary for the river-proximity factor. |
| `data/forest_reserves.geojson` | Placeholder reserve polygons pending official Ghana Forestry Commission shapefiles. |

## `web/` — Next.js app

### Configuration & PWA assets

| File | Purpose |
|---|---|
| `package.json` | Next.js 15, React 19, TypeScript, Tailwind v4, Leaflet, Supabase JS + `@supabase/ssr`, Zod. |
| `next.config.ts` | Security headers: Content-Security-Policy (self + map tiles + Supabase, including its Storage domain), `X-Frame-Options: DENY`, dev-only `unsafe-eval`/HMR relaxation, `geolocation=(self)` for the locate-me and report-form features. |
| `public/manifest.json` | PWA manifest — `start_url` is `/map` (an installed app opens straight to the tool, not the marketing page). |
| `public/sw.js` | Service worker: stale-while-revalidate for same-origin GETs, skips `/api/*` and cross-origin requests. |

### `src/middleware.ts`

Refreshes the Supabase session cookie on every request. No-ops safely when Supabase env vars are absent.

### `src/app/` — routes

| File | Purpose |
|---|---|
| `layout.tsx` | Root layout: PWA metadata, viewport theme color, mounts `InstallPrompt` globally. |
| `page.tsx` | **The landing page.** Server component; fetches live public stats for the impact strip but has no dependency on being signed in or on the map rendering. Hero, live numbers, "how it works," a public/authority split, and a transparency note. |
| `map/page.tsx` | **The interactive dashboard** — was `page.tsx` before the landing page took over "/". Fetches public data + viewer role, renders `Dashboard`. |
| `report/page.tsx` | Public report form. Two-step flow: location is requested first and is a hard requirement (no manual-entry fallback) — denied/unavailable shows the SMS option instead of blocking the citizen entirely. Only then does the description field appear. Submits to `api/reports/web`. |
| `login/page.tsx` | Officer sign-in form. No public signup. |
| `admin/page.tsx` | Redirects to `/login` if signed out, shows `GateMessage` if signed in but not an officer, otherwise fetches officer-scoped dashboard data *and* `pipeline_runs`, and renders `Dashboard` with both. |
| `admin/actions.ts` | Server actions: `setSiteReview`, `setReportStatus`, `signOutAction`, and `requestPipelineRun` (inserts a queued scan request under the signed-in officer's own session — RLS's `officers create pipeline runs` policy is the real enforcement, checking `requested_by = auth.uid()`). |
| `api/reports/route.ts` | **Layer 3** — the [httpsms](https://httpsms.com) SMS webhook. Parses `GALAM <locality> <message>`, geocodes it, and delegates storage + corroboration to `lib/reportIngest.ts`. |
| `api/reports/web/route.ts` | Web report form submission. No shared-secret token (it's a public form endpoint, not a provider webhook) — instead rate-limits by a hashed client IP. Requires real lat/lng from the browser's geolocation API; no locality lookup needed since the coordinates are already exact. Shares the same corroboration logic as the SMS route. |

### `src/components/` — UI

| File | Purpose |
|---|---|
| `Dashboard.tsx` | Client shell, used at both `/map` (public) and `/admin` (officer, with a `pipelineRuns` prop that gates the extra "Scan" tab). Header, mobile drawer, tabbed officer sidebar (Queue / Scan / Map layers), the map, and the site panel. The Scan tab holds the targeted-run request form — pick a point on the map or link a pending report, set a radius, submit — plus a list of past requests with live status. |
| `MapView.tsx` | The Leaflet map. Risk grid, community reports, confirmed sites (dashed gold = pending review), the geolocation "Locate me" control, and **pick-a-point mode** — when active, a click reports its coordinates instead of the usual marker interactions, with a banner and cursor change, and draws the actual scan radius as a circle so the officer sees the real search area. |
| `LayerControls.tsx` | Checkbox toggles for the three data layers. |
| `Legend.tsx` | Color legend plus a plain-language note on how the risk score works. |
| `SitePanel.tsx` | Site detail — before/after wipe slider, NDWI corroboration callout, officer notes, linked reports. Bottom sheet on mobile, floating card on desktop. |
| `InstallPrompt.tsx` | PWA install banner (native prompt capture + iOS fallback). |
| `Onboarding.tsx` | First-visit walkthrough modal, public dashboard (`/map`) only — officers on `/admin` skip it. |
| `GateMessage.tsx` | Shared card for "not configured" / "access restricted" states — used by `/admin`, consistent with the login page's visual identity instead of bare text. |
| `icons.tsx` | Shared minimal line-icon set, including `IconMark` (the reticle logo used across login/gate/error/report screens). |

### `src/lib/` — shared logic

| File | Purpose |
|---|---|
| `types.ts` | TypeScript models for sites, reports, risk cells, layer visibility, and `PipelineRun`. |
| `data.ts` | `getDashboardData` (public, anon-key), `getOfficerDashboardData` (authenticated, sees `pending_review` sites), `getPipelineRuns` (officer-only, empty array on any failure rather than throwing). All fall back gracefully rather than breaking the page. |
| `sample-data.ts` | The bundled known-good demo dataset, kept in sync with `supabase/seed.sql`. |
| `localities.ts` | Small lookup table of Pra-basin towns → coordinates for naive SMS geocoding. Not needed for web reports — those carry real GPS coordinates directly. |
| `geo.ts` | Haversine distance and nearest-point helpers, used by the map's geolocation feature. |
| `export.ts` | Client-side GeoJSON download for the officer "Export" panel. |
| `auth.ts` | `getViewer()` — resolves the current signed-in user and role, or `null`. |
| `reportIngest.ts` | Shared between the SMS and web report routes: `hashIdentifier` (HMAC, used for both phone numbers and IPs), `createRateLimiter`, and `insertReportWithCorroboration` (the "two independent reports within 2km" upgrade rule) — one implementation instead of duplicating it per channel. |
| `supabase/server.ts` | Cookie-based Supabase client for Server Components/Actions — enforces RLS as the actual signed-in user. |
| `supabase/client.ts` | Browser Supabase client, used only by the login form. |

---

## Security model (summary)

1. **No public writes.** RLS gives anon/authenticated roles SELECT only on `published` rows; no general INSERT/UPDATE/DELETE policy for them.
2. **Officers get narrow write paths, not full access.** Column-scoped GRANTs for site/report moderation; a separate, additive-only INSERT policy for `pipeline_runs` (officers request scans, never fake results).
3. **Three write identities, cleanly separated.** The pipeline and both report routes use the service-role key server-side only; officer actions run under the officer's own session; neither is ever exposed to the browser.
4. **Secrets never in git.** `.gitignore` blocks all `.env` files; the service key is never exposed with a `NEXT_PUBLIC_` prefix.
5. **Reporter privacy.** Phone numbers *and* web-report IP addresses are HMAC-SHA256-hashed before storage — the same function, same key, same never-store-the-raw-value rule either way.
6. **Webhook/form hardening.** Constant-time secret comparison (SMS), Zod validation, message/coordinate bounds, per-identity rate limiting, fails closed when unconfigured.
7. **Browser hardening.** Strict Content-Security-Policy, frame-ancestors denial, HTML-escaped user content in map popups.
8. **Data integrity.** DB check constraints on coordinates, score bounds, status enums, message length, and scan radius bounds (100m–20km).

## Running it

```bash
# 1. Database — create a Supabase project, then in the SQL editor run, in order:
#    supabase/migrations/0001_init.sql
#    supabase/migrations/0002_roles_and_moderation.sql
#    supabase/migrations/0003_pipeline_runs.sql
#    supabase/seed.sql

# 2. Web app
cd web
cp .env.example .env.local   # fill in Supabase values (or skip → demo mode)
npm install
npm run dev                  # http://localhost:3000 — landing page; /map is the dashboard

# 3. Pipeline (needs a Google Earth Engine account)
cd pipeline
pip install -r requirements.txt
earthengine authenticate
python run_pipeline.py --basin pra --dry-run          # safe test, writes to out/
python run_pipeline.py --basin pra --limit 10         # small live test push
python run_pipeline.py --basin pra                    # full run → Supabase
python run_pipeline.py --from-queue                   # drain officer-requested targeted scans

# 4. First officer account (manual, one-time)
#    Supabase dashboard → Authentication → Users → Add User
#    Then, in the SQL editor:
#    insert into public.profiles (id, role, full_name, agency)
#    values ('<user-uuid-from-dashboard>', 'officer', 'Name', 'Agency');
```

The dashboard works with **zero configuration** — no env vars means demo mode with the bundled Pra-basin dataset.
