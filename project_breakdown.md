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
│   │   └── 0002_roles_and_moderation.sql  Officer roles + moderation queue on top of 0001
│   └── seed.sql                  Demo dataset for the Pra basin (sites, reports, risk grid)
│
├── pipeline/                     Python data pipeline (Layers 1, 2 & 4)
│   ├── requirements.txt          Python dependencies
│   ├── config.py                 All tunables: basins, dates, thresholds, risk weights
│   ├── detect.py                 Layer 1 — Dynamic World vegetation→bare-ground change
│   ├── water_check.py            Layer 2 — NDWI turbidity cross-check over river pixels
│   ├── risk.py                   Layer 4 — transparent weighted risk scoring
│   ├── push.py                   Writes results to Supabase (service role)
│   ├── run_pipeline.py           CLI orchestrator (full run / dry run / risk-only)
│   ├── check_sites.py            Diagnostic: NDWI coverage stats, flags likely-duplicate sites
│   ├── test_ndwi.py              Diagnostic: tune cloud/date settings without re-running detection
│   └── data/
│       ├── pra_river.geojson     Simplified Pra river line for proximity scoring
│       └── forest_reserves.geojson  Placeholder reserve polygons (replace with official data)
│
└── web/                          Next.js 15 dashboard (Layers 3 & 5, public + authority UI)
    ├── package.json              Dependencies & scripts (dev / build / typecheck)
    ├── tsconfig.json             TypeScript config (strict mode)
    ├── next.config.ts            Security headers incl. Content-Security-Policy
    ├── postcss.config.mjs        Tailwind CSS v4 wiring
    ├── .env.example              Web-app subset of the env template
    ├── public/
    │   ├── manifest.json         PWA manifest (name, icons, standalone display)
    │   ├── sw.js                 Service worker — offline app-shell caching
    │   ├── apple-touch-icon.png  iOS home-screen icon
    │   └── icons/                Full PWA icon set (16/32/192/512px)
    └── src/
        ├── middleware.ts         Refreshes the Supabase auth session cookie on every request
        ├── app/
        │   ├── layout.tsx        Root HTML shell, PWA metadata, mounts InstallPrompt
        │   ├── page.tsx          Server component: fetches data + viewer role, renders Dashboard
        │   ├── globals.css       Tailwind import, black/gold theme tokens, Leaflet sizing
        │   ├── favicon.ico       Browser tab icon
        │   ├── login/
        │   │   └── page.tsx      Officer sign-in (no public self-signup)
        │   ├── admin/
        │   │   ├── page.tsx      Server component: gates on officer role, fetches pending queue
        │   │   ├── AdminQueue.tsx  Client component: publish/reject buttons, mobile-responsive
        │   │   └── actions.ts    Server actions — run under the signed-in officer's own session
        │   └── api/reports/
        │       └── route.ts      Africa's Talking SMS webhook (Layer 3)
        ├── components/
        │   ├── Dashboard.tsx     Client shell: header, retractable mobile drawer, sidebar, map
        │   ├── MapView.tsx       Leaflet map: sites, reports, risk grid, base layers, geolocation
        │   ├── LayerControls.tsx Sidebar toggles for the three data layers
        │   ├── Legend.tsx        Marker/heatmap legend + risk-model explainer
        │   ├── SitePanel.tsx     Site detail — before/after wipe slider, bottom sheet on mobile
        │   ├── InstallPrompt.tsx PWA install banner (native prompt capture + iOS fallback)
        │   └── icons.tsx         Shared minimal line-icon set (close, locate, menu, chevron)
        └── lib/
            ├── types.ts          Shared TypeScript types for all data models
            ├── data.ts           Supabase reads with fallback to bundled demo data
            ├── sample-data.ts    Known-good demo dataset (mirrors seed.sql)
            ├── localities.ts     Pra-basin locality → coordinates for SMS geocoding
            ├── geo.ts            Haversine distance + nearest-point helper (geolocation feature)
            ├── export.ts         Client-side GeoJSON export (officer "Authority tools")
            ├── auth.ts           getViewer() — current user + role, or null
            └── supabase/
                ├── server.ts     Server Component / Server Action Supabase client
                └── client.ts     Browser Supabase client (used by the login form)
```

---

## Root files

| File | Purpose |
|---|---|
| `README.md` | The project reference: problem, pitch, five-layer architecture, public vs. authority UX, PWA/mobile notes, tech stack, data model, security model, deployment. |
| `project_breakdown.md` | This document. |
| `Galamsey_Eye_Project_Doc.docx` | The original hackathon planning document the build started from. |
| `.gitignore` | Excludes `node_modules`, builds, Python caches, pipeline outputs, and — critically — every `.env` variant and credential file, so secrets can never be committed. |
| `.env.example` | Documents every secret the system needs (Supabase keys, webhook secret, phone-hash key, Earth Engine project). Copy to `.env` / `web/.env.local` and fill in; real files are git-ignored. |

## `supabase/` — database

| File | Purpose |
|---|---|
| `migrations/0001_init.sql` | Creates `confirmed_sites`, `community_reports`, `risk_scores` with check constraints, indexes, and baseline RLS: public roles get SELECT only, no write policy exists for them. `phone_hash` is additionally revoked from the anon API surface. |
| `migrations/0002_roles_and_moderation.sql` | Adds `profiles` (officer/admin roles tied to Supabase Auth users), a `SECURITY DEFINER` `is_officer()` helper, `review_status`/`officer_notes` columns on `confirmed_sites`, and narrows the public read policy to `review_status = 'published'` only. Officers get a **column-scoped** UPDATE grant — never full table access — enforced by Postgres, not the app. |
| `seed.sql` | Demo dataset: 5 confirmed sites, 12 community reports, a risk grid. Mirrors `web/src/lib/sample-data.ts` so live mode and demo mode look identical when the pipeline hasn't been run. |

## `pipeline/` — Python data pipeline

Runs as a one-off/periodic script, not a server — it writes to Supabase and exits. The dashboard never depends on it being "up."

| File | Purpose |
|---|---|
| `config.py` | Single source of truth for every tunable: basin bounding boxes, date windows, Dynamic World class ids, cluster-size threshold, cloud limits (tuned to 50% after real-world testing — `CLOUDY_PIXEL_PERCENTAGE` is a whole-tile average, not per-site), NDWI noise threshold, and the documented risk-model weights. |
| `detect.py` | **Layer 1.** Pulls two Dynamic World time slices, flags vegetation→bare-ground clusters, filters noise, vectorizes results, and downloads real before/after Sentinel-2 thumbnails as bytes (not URLs — Earth Engine's own links are ephemeral). Computes centroid/area locally via `shapely` rather than extra Earth Engine round-trips, and retries transient network failures. |
| `water_check.py` | **Layer 2.** Mean NDWI over a 60 m river buffer, before vs. after. Catches Earth Engine's "empty composite" exception when clouds block a window for a given site, so one sparse site never crashes the whole run. |
| `risk.py` | **Layer 4.** Scores a ~1.1 km grid with four explainable factors combined per `config.py`'s weights, plus a clamped gold-price multiplier. Cell IDs are built from exact integer grid indices, not formatted floating-point coordinates — a real bug where every cell sat exactly on a `.2f` rounding boundary (due to the centering offset) caused occasional duplicate-ID collisions until fixed. |
| `push.py` | The only writer to the database. Deduplicates sites (~100 m, scoped per basin), uploads before/after images to a Supabase Storage bucket (auto-created on first run) and swaps in permanent URLs, and marks new automated detections `review_status = 'pending_review'`. Replaces a basin's risk grid via delete-then-insert (an earlier upsert-then-filter-delete approach broke on a real 1000+ cell grid — the URL-embedded filter list exceeded the URL length limit). |
| `run_pipeline.py` | CLI entry point: `--dry-run` writes GeoJSON + images to `pipeline/out/` without touching the DB, `--skip-detect` refreshes only the risk grid using sites already in Supabase, `--limit N` caps how many detected sites get processed (for a small live test push before committing to a full run). Forces UTF-8 stdout so progress messages with special characters don't crash on Windows when output is redirected. |
| `check_sites.py` | Standalone diagnostic — run against a dry-run's `out/*.geojson` to see NDWI coverage % and flag sites within 150 m of each other (likely fragments of one real clearing). |
| `test_ndwi.py` | Standalone diagnostic — replay the water-check step with different cloud/date settings against already-detected sites, without re-running the slow detection step. |
| `data/pra_river.geojson` | Simplified Pra main stem + one tributary as line geometry for the river-proximity factor. |
| `data/forest_reserves.geojson` | Placeholder reserve polygons pending official Ghana Forestry Commission shapefiles — clearly labelled as such. |

## `web/` — Next.js dashboard

### Configuration & PWA assets

| File | Purpose |
|---|---|
| `package.json` | Next.js 15, React 19, TypeScript, Tailwind v4, Leaflet, Supabase JS + `@supabase/ssr`, Zod. |
| `tsconfig.json` | Strict TypeScript, `@/*` path alias to `src/`. |
| `next.config.ts` | Security headers on every response: Content-Security-Policy (locked to self + map tiles + Supabase, including the Storage domain that serves site photos), `X-Frame-Options: DENY`, a dev-only relaxation for `unsafe-eval`/HMR websockets (Next's Fast Refresh needs it; production stays strict), and `geolocation=(self)` in Permissions-Policy for the locate-me feature. |
| `public/manifest.json` | PWA manifest — name, icons, `display: standalone`, black theme color. |
| `public/sw.js` | Service worker: stale-while-revalidate for same-origin GETs, explicitly skips `/api/*` (data freshness over speed) and cross-origin requests (Supabase, tiles). |
| `public/icons/`, `favicon.ico`, `apple-touch-icon.png` | Full icon set generated from a minimal gold targeting-reticle mark. |

### `src/middleware.ts`

Refreshes the Supabase session cookie on every request so Server Components always see an up-to-date auth state. No-ops safely when Supabase env vars are absent, so demo mode still works with zero configuration.

### `src/app/` — routes

| File | Purpose |
|---|---|
| `layout.tsx` | Root layout: PWA metadata (manifest link, icons, `appleWebApp` config), viewport theme color, mounts `InstallPrompt` globally. |
| `page.tsx` | Server component. Fetches dashboard data *and* the current viewer's role in parallel, hands both to the client `Dashboard`. |
| `globals.css` | Tailwind import, black/gold theme tokens defined via Tailwind v4's `@theme`, Leaflet container sizing. |
| `login/page.tsx` | Officer sign-in form. No public signup — accounts are provisioned manually (Supabase dashboard + a `profiles` row), matching how real institutional access would be granted. |
| `admin/page.tsx` | Server component. Redirects to `/login` if signed out, shows a plain message if signed in but not an officer, otherwise fetches the pending-review queue. |
| `admin/AdminQueue.tsx` | Client component rendering the queue with Publish/Reject/Confirm buttons; stacks vertically on mobile instead of cramping next to the text. |
| `admin/actions.ts` | Server actions for publish/reject/sign-out. Run under the **signed-in user's own session** (not the service role) — the database's `is_officer()` policy is the real enforcement, not the button being hidden in the UI. |
| `api/reports/route.ts` | **Layer 3** — the Africa's Talking SMS webhook. Parses `GALAM <locality> <message>`, geocodes it, stores a pending report, and auto-upgrades to confirmed on a second independent nearby report. Constant-time secret check, HMAC-hashed phone numbers, Zod validation, per-sender rate limiting, fails closed when unconfigured. |

### `src/components/` — UI

| File | Purpose |
|---|---|
| `Dashboard.tsx` | Client shell. Header with live stats (compressed on mobile into a second row), a retractable sidebar drawer on mobile (backdrop + slide transition, untouched permanent sidebar on desktop), and the map. Shows officer-only "Authority tools" (GeoJSON export) when signed in with that role. |
| `MapView.tsx` | The Leaflet map. Risk grid as score-colored rectangles with factor-breakdown tooltips, community reports as gold (pending)/red (confirmed) dots, confirmed sites as red markers, Streets/Satellite base layers, and the "Locate me" geolocation control with nearest-site/highest-nearby-risk callouts. |
| `LayerControls.tsx` | Checkbox toggles for the three data layers. |
| `Legend.tsx` | Color legend plus a plain-language note on how the risk score works. |
| `SitePanel.tsx` | Site detail — before/after wipe slider (real photos when available, labelled placeholder otherwise), NDWI corroboration callout, officer notes, linked community reports. Renders as a bottom sheet on mobile, a floating top-right card on desktop. |
| `InstallPrompt.tsx` | Registers the service worker; captures the browser's `beforeinstallprompt` event to show a custom install banner, falls back to manual instructions on iOS. Remembers dismissal in `localStorage`. |
| `icons.tsx` | Shared minimal line-icon set (close, locate/crosshair, hamburger menu, chevron) — flat SVGs matching the app's mark, replacing earlier emoji glyphs. |

### `src/lib/` — shared logic

| File | Purpose |
|---|---|
| `types.ts` | TypeScript models for sites, reports, risk cells, layer visibility, and review status — the contract between DB rows and UI. |
| `data.ts` | All public dashboard reads, anon-key only. Falls back to the bundled sample dataset on missing config or any fetch failure, flagging `demoMode`. |
| `sample-data.ts` | The bundled known-good demo dataset, kept in sync with `supabase/seed.sql`. |
| `localities.ts` | Small lookup table of Pra-basin towns → coordinates for naive SMS geocoding. |
| `geo.ts` | Haversine distance and nearest-point helpers, used by the map's geolocation feature. |
| `export.ts` | Client-side GeoJSON download (no server round-trip) for the officer-only export buttons. |
| `auth.ts` | `getViewer()` — resolves the current signed-in user and role (or `null`), used by both the public dashboard (to show/hide officer tools) and the admin gate. |
| `supabase/server.ts` | Cookie-based Supabase client for Server Components and Server Actions — enforces RLS as the actual signed-in user. |
| `supabase/client.ts` | Browser Supabase client, used only by the login form. |

---

## Security model (summary)

1. **No public writes.** RLS gives anon/authenticated roles SELECT only on `published` rows; there is no general INSERT/UPDATE/DELETE policy for them.
2. **Officers get a narrow write path, not full access.** A `SECURITY DEFINER` role check plus column-scoped GRANTs let officers update only `review_status`/`officer_notes`/report `status` — enforced in Postgres regardless of what the UI shows.
3. **Two write identities, cleanly separated.** The pipeline and SMS webhook use the service-role key server-side only; officer actions run under the officer's own session. Neither is ever exposed to the browser.
4. **Secrets never in git.** `.gitignore` blocks all `.env` files; the service key is never exposed with a `NEXT_PUBLIC_` prefix.
5. **Reporter privacy.** Phone numbers are HMAC-SHA256-hashed before storage; the hash column is revoked from the public API entirely.
6. **Webhook hardening.** Constant-time secret comparison, Zod validation, message length caps, per-sender rate limiting, fails closed when unconfigured.
7. **Browser hardening.** Strict Content-Security-Policy (including the Supabase Storage domain that serves real site photos), frame-ancestors denial, HTML-escaped user content in map popups.
8. **Data integrity.** DB check constraints on coordinates, score bounds, status enums, message length.

## Running it

```bash
# 1. Database — create a Supabase project, then in the SQL editor run, in order:
#    supabase/migrations/0001_init.sql
#    supabase/migrations/0002_roles_and_moderation.sql
#    supabase/seed.sql

# 2. Dashboard
cd web
cp .env.example .env.local   # fill in Supabase values (or skip → demo mode)
npm install
npm run dev                  # http://localhost:3000

# 3. Pipeline (needs a Google Earth Engine account)
cd pipeline
pip install -r requirements.txt
earthengine authenticate
python run_pipeline.py --basin pra --dry-run          # safe test, writes to out/
python run_pipeline.py --basin pra --limit 10         # small live test push
python run_pipeline.py --basin pra                    # full run → Supabase

# 4. First officer account (manual, one-time)
#    Supabase dashboard → Authentication → Users → Add User
#    Then, in the SQL editor:
#    insert into public.profiles (id, role, full_name, agency)
#    values ('<user-uuid-from-dashboard>', 'officer', 'Name', 'Agency');
```

The dashboard works with **zero configuration** — no env vars means demo mode with the bundled Pra-basin dataset.
