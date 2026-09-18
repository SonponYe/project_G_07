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

## How each piece actually works

The tables above say what each file is *for*. This section says how the interesting ones actually work internally — the real algorithms, not just one-line summaries. Skip to whichever piece you're trying to understand.

### The pipeline, function by function

#### `config.py` — tunables, and the point→bbox math

Everything the pipeline can be tuned by lives here as module-level constants, not scattered magic numbers: basin bounding boxes, the two comparison date windows (`BEFORE_WINDOW`, `AFTER_WINDOW`), Dynamic World's numeric class ids, the minimum cluster size to count as a real site, the cloud-cover ceiling, the NDWI noise threshold, the risk-model weights and decay distances, and the score floor below which a grid cell isn't stored.

The one real function here, `bbox_from_center(lat, lng, radius_m)`, is what turns an officer's "scan around this point" request into the rectangle `detect_change` actually queries. It can't just add/subtract the same number of degrees to lat and lng, because a degree of longitude is shorter than a degree of latitude everywhere except the equator — it shrinks by `cos(latitude)`. So:

```python
deg_lat = radius_m / _METERS_PER_DEG_LAT                       # 111,320 m per degree, constant
deg_lng = radius_m / (_METERS_PER_DEG_LAT * cos(radians(lat)))  # widens as you move from the equator
```

Get this wrong and a "2km radius" scan would be visibly egg-shaped — too narrow east-west near Ghana's latitude, or (further from the equator) too wide.

#### `detect.py` — Layer 1: the actual change-detection algorithm

`init_ee(project)` picks one of two auth paths transparently: if `EE_SERVICE_ACCOUNT_EMAIL`/`EE_SERVICE_ACCOUNT_KEY` are set (true in the GitHub Actions job, where there's no browser for interactive login), it builds `ee.ServiceAccountCredentials` from the raw JSON key content; otherwise it calls `ee.Initialize(project=project)`, which relies on the credentials cached locally by a one-time `earthengine authenticate`. Nothing downstream needs to know which path ran.

`detect_change(basin_key, bbox=None)` is the real algorithm:

1. **Two land-cover snapshots.** `_dw_mode(geom, start, end)` filters the `GOOGLE/DYNAMICWORLD/V1` collection to a date window and region, and reduces to the pixel-wise **mode** (most frequent label) across every image in that window — this is what makes a single cloudy or misclassified image harmless; the label has to be the *typical* one across the whole window to count. This runs once for `BEFORE_WINDOW` and once for `AFTER_WINDOW`.
2. **Vegetation-to-bare mask.** `was_vegetation` is built by OR-ing together `before.eq(cls)` for each class in `VEGETATION_CLASSES` (trees, grass, crops). `change = was_vegetation.And(after.eq(DW_BARE)).selfMask()` — a pixel only survives if it was vegetated before *and* is bare-ground-classified after. `selfMask()` drops every pixel that didn't match, so what's left is sparse.
3. **Noise filtering by cluster size.** A single flipped pixel is far more likely to be a classification error than a real mine. `change.connectedPixelCount(100, True)` counts, per pixel, how many *connected* flagged pixels it belongs to (capped at 100 for performance), and `updateMask(cluster_size.gte(MIN_CLUSTER_PIXELS))` drops anything below the threshold (8 pixels ≈ 800 m² at 10 m resolution). This is the entire "is this noise or a real clearing" decision — no ML classifier, just connected-component size.
4. **Vectorization.** `reduceToVectors(scale=10, geometryType="polygon", eightConnected=True)` turns the surviving raster mask into actual polygon features — one per connected blob.
5. **Per-site output.** For each vectorized polygon: `_local_centroid_area()` computes the centroid and area **locally** with `shapely` from the already-fetched GeoJSON, rather than round-tripping to Earth Engine again for `.centroid()`/`.area()` — this alone removes 2 Earth Engine calls per site (534 calls saved across a real 267-site run, and network calls were exactly where long runs were flaking). The area conversion uses a flat equirectangular approximation (`lat_m_per_deg = 111_320`, `lng_m_per_deg = 111_320 * cos(radians(lat))`) which is accurate to well under 1% this close to the equator. Then `_thumb_bytes()` downloads a real true-colour PNG (via `visualize(bands=["B4","B3","B2"])` + `getThumbURL` + a plain `requests.get`) for both the before and after Sentinel-2 composites, over the site's polygon buffered by 500 m for visual context — returning `None` on any failure so one bad thumbnail never kills the whole run.

`_get_info_with_retry()` wraps every `.getInfo()` call (the point where a long server-side Earth Engine computation actually gets pulled down) with up to 3 attempts and a 5s backoff — a transient DNS hiccup shouldn't discard a computation that already finished on Google's side.

Passing `bbox` (from `config.bbox_from_center`) instead of leaving it `None` is the entire mechanism behind officer-requested targeted scans — same function, same algorithm, just a smaller `ee.Geometry.Rectangle`. `basin_key` still gets attached to each result and still selects which basin's river/reserve reference data will score it later, even though it no longer controls the search area.

#### `water_check.py` — Layer 2: the NDWI cross-check

NDWI (Normalized Difference Water Index) is `(green - nir) / (green + nir)`, computed here as `composite.normalizedDifference(["B3", "B8"])` (Sentinel-2's green and near-infrared bands). Water reflects green light and absorbs near-infrared, so higher NDWI ≈ more/clearer water; a drop means the water got more turbid — consistent with sediment runoff from an upstream clearing.

`_mean_ndwi(point, start, end)` buffers the site's point by `RIVER_BUFFER_M` (60 m) and takes the **median** Sentinel-2 composite over the window (median, not mean, so a handful of still-cloudy pixels don't drag the composite off), then reduces to the mean NDWI in that buffer. It explicitly catches `ee.ee_exception.EEException`, because an all-cloud date window produces an empty composite that Earth Engine rejects when you try to reduce it — that's a legitimate "no data," not a bug, so it returns `None` rather than raising.

`ndwi_drop(lat, lng)` calls `_mean_ndwi` for both windows and returns `after - before`, or `None` if either side came back empty. **A drop is not automatically corroborating** — `run_pipeline.py` only sets `water_corroborated = True` when the drop is *more negative* than `NDWI_DROP_THRESHOLD` (a small negative noise floor). A missing reading or a rise (water got clearer, not muddier) is correctly treated as not-corroborated, never silently upgraded to a positive signal.

#### `risk.py` — Layer 4: the transparent risk score

`score_grid(basin_key, confirmed_sites, slope_lookup=None)` lays a grid of `GRID_CELL_DEG` (0.01°, ≈1.1 km) cells over the basin and, for each cell center, computes four independent 0–1 factors and combines them with fixed weights from `config.RISK_WEIGHTS` — there is no training step; every number a cell gets is traceable back to a distance and a weight.

Each proximity factor uses the same exponential decay shape, `_decay(distance_km, scale_km) = exp(-distance_km / scale_km)` — 1.0 at distance 0, falling off smoothly, never hitting exactly zero. The three proximity factors (`site_proximity`, `river_proximity`, `reserve_proximity`) each call `_km_to_nearest(point, geoms)` against the nearest confirmed site / river line / reserve polygon (loaded once via `_load_geojson_geoms`) and decay it with a different scale (`SITE_DECAY_KM=5`, `RIVER_DECAY_KM=2`, `RESERVE_DECAY_KM=3` — rivers matter at closer range than the general site-spread radius). The fourth factor, `slope_access`, is `1 - slope/MAX_ACCESSIBLE_SLOPE_DEG` from an optional SRTM slope lookup (steep terrain is harder for mining equipment to reach), falling back to a neutral `0.7` when no slope data was sampled — the demo must never break just because Earth Engine's slope call failed.

The one real historical **bug fix** worth knowing about: cell ids used to be built as `f"{lat:.2f}_{lng:.2f}"`. Because the grid is built with a half-cell offset (`cell/2`) at exactly `0.01°` spacing, every single cell center's coordinates landed *exactly* on a `.2f` rounding boundary — so formatting to 2 decimal places silently collided pairs of distinct cells into the same string id, which then crashed the Postgres upsert on a duplicate-key conflict (51 collisions out of 1,148 cells in one real run). The fix was to stop deriving the id from the float coordinates at all and build it from the **integer loop indices** instead — `cell_id = f"{basin_key}_{i}_{j}"` — which can never collide regardless of how the floating-point center happens to round.

The optional `GOLD_TREND_MULTIPLIER` env var (default 1.0, neutral) is clamped to `[0.8, 1.3]` before being applied, so a bad or extreme external value can't blow the score outside a sane range. Only cells scoring `>= MIN_SCORE_TO_STORE` (0.30) are returned — the grid isn't meant to show "everywhere is a little bit risky," only areas worth an officer's attention.

#### `push.py` — the only writer, and the scan queue

Every write to Supabase goes through this module, using the **service-role key** (bypasses RLS) — which is exactly why it's the only thing allowed to write; nothing else in the codebase holds that key.

`push_sites(client, sites, pipeline_run_id=None)` dedupes before inserting: for each candidate it queries `confirmed_sites` for an existing row within roughly ±0.001° (~100 m) **and the same basin** — scoped to basin deliberately, since two different basins' bounding boxes can overlap in raw lat/lng, and an unscoped check could mistake a genuine new site in one basin for a duplicate of something in another. Surviving sites get a random 12-hex-char id, have their raw image bytes swapped for permanent Supabase Storage URLs via `_upload_image()` (which never raises — a failed upload just leaves the URL `None` rather than losing the whole site), and are force-set to `review_status = "pending_review"` regardless of what detect.py put there — new automated detections always need a human officer to publish them. When called from a targeted scan, `pipeline_run_id` gets attached so the site can be traced back to the request that found it.

`replace_risk_grid(client, basin, rows)` deletes every existing row for that basin and re-inserts the fresh grid in batches of 500. This replaced an earlier upsert-then-delete-stale-rows approach that built a `NOT IN (...)` filter listing every fresh cell id **in the URL query string** — harmless for a small grid, but a real 1000+-cell basin blew past the URL length limit and crashed with `httpx.InvalidURL`. Delete-then-insert with the payload in the request body sidesteps that entirely.

The **queue helpers** at the bottom (`get_queued_runs`, `mark_run_running`, `mark_run_done`, `mark_run_failed`) are what `run_pipeline.py --from-queue` uses to drive `pipeline_runs` through its status lifecycle. `_now_iso()` exists because an earlier version passed the literal string `"now()"` as a timestamp — which Supabase's REST API stores as literal *text* in a `timestamptz` column rather than evaluating as SQL (unlike a raw SQL `INSERT ... VALUES (now())` would). The fix computes a real UTC timestamp in Python instead of ever trusting the API to interpret a magic string.

#### `run_pipeline.py` — orchestration, and the queue-drain path

The CLI wires the above pieces together in three phases (detect → water-check → risk-score), controllable via `--dry-run` (writes GeoJSON + local images to `pipeline/out/`, touches no database), `--skip-detect` (risk grid only, reusing existing `confirmed_sites` as anchors — for a cheap periodic risk refresh without re-running detection), and `--limit N` (caps how many detected sites get water-checked/pushed, for a small live test before committing to a full run).

`--from-queue` runs a completely different path, `run_from_queue()`, built for the scheduled GitHub Actions job:

1. It gets a Supabase client and calls `push.get_queued_runs()` **before importing `detect`/`water_check` or touching Earth Engine at all**. Since this runs on a 15-minute cron and an empty queue is the overwhelmingly common case, there's no reason to pay for an Earth Engine auth handshake on every tick when there's nothing queued — it just prints `"No queued pipeline runs."` and exits.
2. For each queued run, it marks it `running`, derives a bbox via `config.bbox_from_center(center_lat, center_lng, radius_m)`, calls `detect.detect_change(basin, bbox=bbox)`, water-checks every candidate the same way the main flow does, and pushes them tagged with that run's id.
3. **It deliberately never calls `risk.score_grid` / `push.replace_risk_grid` for a targeted run.** `replace_risk_grid` deletes an entire basin's grid before reinserting — correct for a whole-basin pass, but catastrophic here: a 2 km-radius scan would delete the basin's real, whole-region risk grid and replace it with a handful of cells around one point. Refreshing risk stays a separate, explicit, whole-basin `--skip-detect` run.
4. Each run is wrapped in its own `try/except` so one failing run (bad coordinates, an Earth Engine timeout) marks itself `failed` with the error message and lets the loop continue to the next queued run, rather than one bad request stalling every citizen tip behind it.

`build_slope_lookup(basin_key)` samples SRTM slope once per whole-basin run (at grid resolution, via a single `.sample().getInfo()` call) and returns a `(lat, lng) -> slope` closure keyed by coordinates rounded to match the grid — this is what feeds `risk.py`'s `slope_access` factor. It's wrapped in a blanket `try/except` too: any Earth Engine failure here just falls back to `risk.py`'s neutral `0.7` default rather than aborting the whole pipeline run over one optional signal.

Also worth knowing: the top of the file force-reconfigures `sys.stdout`/`sys.stderr` to UTF-8. Windows defaults a *non-interactive* stdout (piped, redirected, or backgrounded — exactly how the GitHub Actions runner invokes it) to the legacy `cp1252` codepage, and the progress messages below use arrow/ellipsis characters that crash with `UnicodeEncodeError` under that codepage — after all the real Earth Engine/Supabase work already succeeded. Without this line, a run could do everything right and still be reported "failed" purely because of its last `print()`.

### The web app, piece by piece

#### Auth & session — `middleware.ts`, `lib/auth.ts`, and RLS underneath both

`middleware.ts` runs on every request matching its matcher (everything except static assets). If Supabase env vars aren't set it's a pure no-op — the app still runs in demo mode with zero config. Otherwise it builds a `createServerClient` wired to read/write cookies straight off the request/response, and calls `supabase.auth.getUser()` purely for its **side effect**: if the access token cookie is stale, this call silently refreshes it and the `setAll` callback writes the new cookie onto the response. Every Server Component in the app then sees a valid session without ever handling token refresh itself.

`getViewer()` (`lib/auth.ts`) is the single place that turns "a Supabase session" into "a role the app can gate UI on." It calls `supabase.auth.getUser()` again (cheap — reads the already-refreshed cookie) and, if there's a user, looks up their row in `profiles` for a `role` (`viewer` default if the profile lookup fails or returns nothing). It's wrapped in a blanket `try/catch` returning `null` — a Supabase hiccup should degrade to "not signed in," never crash the page. `isOfficer(viewer)` is just `role === "officer" || role === "admin"`, checked wherever the UI needs to gate something client-side.

The important part: `getViewer()`/`isOfficer()` gating is a **UX convenience only**. The real enforcement is Postgres RLS (0002/0003 migrations) — even if the client-side check were somehow bypassed, the database itself rejects an UPDATE from a non-officer or an INSERT into `pipeline_runs` under someone else's `auth.uid()`.

#### Report ingestion — the corroboration algorithm in `reportIngest.ts`

Both report channels (SMS and the web form) funnel through `insertReportWithCorroboration(supabase, report)`, so the "when does a report become trusted" logic exists in exactly one place:

1. Insert the new report as `status: "pending"`, storing `phone_hash` (actually an HMAC hash of *either* a phone number or, for web reports, an IP address — same field, same hashing function, different source of the identity being hashed), the message, locality (SMS only), and lat/lng.
2. If the insert has real coordinates, query for any **other** pending report — `neq("id", inserted.id)` and, critically, `neq("phone_hash", report.reporterHash)` — within `NEARBY_DEG = 0.02°` (~2 km) of it in both lat and lng (a simple bounding-box check, not a true circular radius, which is a deliberately cheap approximation at this scale).
3. If any such reports exist, **every** matching report plus the new one gets updated to `status: "confirmed"` in one batch `.in("id", ids)` update.

The `neq("phone_hash", ...)` clause is the whole point: this is specifically an "two *independent* people reported the same area" signal, not "the same person texted twice." `hashIdentifier(value, key)` is a plain `createHmac("sha256", key).update(value.trim()).digest("hex")` — deterministic (so the same phone number always hashes to the same value, letting rate-limiting and dedup work) but not reversible, so a raw phone number or IP is never recoverable from what's stored. `createRateLimiter(limit, windowMs)` is a simple in-memory sliding window keyed by that same hash — per serverless instance, which is an accepted simplification at current scale (documented in the file as the first thing to swap for a shared store like Upstash if load ever demands it).

#### The SMS webhook — `api/reports/route.ts`

httpsms posts a JSON event to this route for every SMS its linked Android phone receives. Five things happen in order before any data is trusted: (1) the shared-secret `?token=` query param is compared against `AT_WEBHOOK_SECRET` using `timingSafeEqual` — a naive `===` string comparison would leak timing information an attacker could use to guess the secret byte-by-byte; (2) the JSON body is loosely validated as *some* object via a passthrough Zod schema (httpsms's exact envelope shape hasn't been exercised against a live payload yet, so `extractMessage()` defensively tries several plausible field names — `from`/`contact`/`sender`, `content`/`text`/`message`/`body` — nested under a `data` key or not, and logs the raw body if nothing matches rather than 400-ing, so httpsms never sees a failure and disables the webhook over an unrecognized-but-harmless shape); (3) the sender's hashed phone number is rate-limited to 5/hour; (4) the message must match `/^\s*galam\b\s*(.*)$/is` (the `GALAM` keyword, case-insensitive) or it's silently acknowledged and discarded — not every SMS to the number is a report; (5) `geocodeLocality()` looks up the first word(s) against a small hardcoded Pra-basin town table to turn `"GALAM Daboase mining near the river"` into real coordinates, stripping the locality name back out of the stored message text so it isn't duplicated. The result is hashed and handed to `insertReportWithCorroboration`, using a service-role client created inline (never the cookie-based one — this request has no user session at all).

#### The web report form — `report/page.tsx` + `api/reports/web/route.ts`

The client page is a small state machine with three steps: `"location"` (request `navigator.geolocation`, mandatory — there is deliberately no manual-entry fallback, since an unverifiable typed-in location defeats the point of a GPS-backed report; if permission is denied or unsupported, the UI switches to showing the SMS-report instructions instead of dead-ending the citizen) → `"form"` (the description text field, now that real coordinates are in hand) → `"sent"`.

The route itself is simpler than the SMS one because it isn't a provider webhook — there's no shared secret to check, since anyone hitting a public form endpoint is expected. Zod enforces `lat`/`lng` bounds and a message length cap; the anti-abuse control instead rate-limits by a hashed **client IP** (`x-forwarded-for`, first entry) at the same 5/hour rate as SMS. It calls the identical `insertReportWithCorroboration`, with `locality: null` (coordinates are already exact, so no geocoding step is needed) — meaning a web report and an SMS report from a different, independent person 1.5 km away will cross-corroborate each other automatically, exactly like two SMS reports would.

#### `Dashboard.tsx` — the Scan tab's state machine

The Scan tab (rendered only when `pipelineRuns` is passed in — i.e. only on `/admin`, gating the whole feature off the public `/map`) manages a center point four different ways that all converge on the same two string state variables, `centerLat`/`centerLng`:

- **Pick on map** — `pickMode` toggles on; `MapView` is told `pickMode={tab === "scan" && pickMode}`, and a click anywhere on the map calls `handlePickPoint(lat, lng)`, which fills both fields (to 5 decimal places) and immediately flips `pickMode` back off (one click, one pick — no need to explicitly cancel picking mode).
- **Paste coordinates** — `handlePasteCoords(value)` runs a single regex, `/(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)/`, against whatever's typed or pasted into a plain text input. This matches the "lat, lng" shape most map apps (Google Maps included) give you when you copy a location — two signed decimal numbers separated by a comma and/or whitespace — without forcing the officer to manually split it into two fields. Anything that parses to `NaN` or falls outside valid lat/lng bounds (`|lat| > 90` or `|lng| > 180`) is silently ignored rather than shown as an error, since this fires on every keystroke and partial input is expected while typing.
- **Manual number inputs** — plain controlled `<input type="number">`s for lat/lng directly, always kept in sync with whichever of the above methods was last used.
- **Link to a pending report** — a `<select>` of open community reports; `handleSelectReport(reportId)` looks the report up in `initial.reports` and, if it has coordinates, fills the same two fields — this is the "run a scan centered on this citizen's tip" path, and also sets `scanReportId` so the resulting `pipeline_runs` row records which report triggered it.

`pickedPoint` is derived (not stored as its own state) from whether `centerLat`/`centerLng` currently parse as valid numbers — so *any* of the four input methods immediately shows a live marker + radius circle on the map via `MapView`'s `pickedPoint`/`pickedRadiusM` props, without the Dashboard needing to know which method was used.

`handleScanSubmit` re-validates on submit (lat/lng parse as numbers; radius parses as an integer within `100`–`20000`) even though the inputs already constrain most of this, because pasted/programmatic values can bypass HTML input constraints. On success it calls the `requestPipelineRun` server action, resets the form fields, and calls `router.refresh()` so the new `queued` row shows up in "Past requests" — server state, not local state, is the source of truth for what's actually queued.

#### `MapView.tsx` — pick-a-point mode and rendering

The map keeps five separate Leaflet `LayerGroup`s (`sites`, `reports`, `risk`, `locate`, `pick`) so redrawing one kind of marker (e.g. risk cells, on a layer-toggle change) never has to touch or flicker the others.

Pick mode is implemented as its own small `useEffect` keyed on `[pickMode, onPickPoint]`: while active, it sets the map container's CSS `cursor` to `crosshair` and attaches a single Leaflet `click` handler that forwards `e.latlng.lat/lng` straight to the `onPickPoint` callback (which is `Dashboard`'s `handlePickPoint`) — the effect's cleanup function (returned on every re-render/unmount) resets the cursor and detaches the listener, so leaving the Scan tab or turning pick mode off never leaves a stray click handler wired up. A separate effect (keyed on `[pickedPoint, pickedRadiusM]`) redraws the `pick` layer group from scratch on every change: a dashed gold `L.circle` at the real scan radius (so the officer sees the actual search area, not just an abstract dot) plus a small solid marker at the exact center.

`riskColor(score)` is a plain 4-bucket step function (`>=0.8` red, `>=0.65` orange, `>=0.5` gold, else muted gold) — not a continuous gradient, deliberately, so the map reads at a glance rather than requiring a legend lookup for subtle color differences. `handleLocate()` wraps the browser Geolocation API: on success it computes the nearest confirmed site and the highest-scoring risk cell within 15 km (not simply the *nearest* risk cell, which could be a low-risk one right next door while a genuinely dangerous zone sits slightly further away) via the plain haversine helpers in `lib/geo.ts`, and flies the map to the user's position with an accuracy-radius circle and a popup summarizing both distances.

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
