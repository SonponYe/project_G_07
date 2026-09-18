# G07

**Pronounced "Geo-7" — satellite + community detection and prediction of illegal mining**

Originally built for the Pan-African AI Summit Hackathon 2026 (ClimateTech Track); since extended into a working system with real satellite detections, an officer moderation workflow, and a mobile-first PWA dashboard.

## Status

- **238 real illegal-mining candidate sites** detected from live Google Earth Engine data over the Pra river basin, each with genuine Sentinel-2 before/after imagery and an NDWI water-turbidity cross-check.
- **1,464-cell predictive risk grid** computed and live.
- A public landing page, a public map + web report form, and an authenticated officer moderation portal (`/admin`) — three surfaces, one backend.
- Officers can request a **targeted scan** (a point + radius) instead of waiting on a whole-basin run — built specifically to respond to a fresh citizen tip.
- Installable as a PWA on phone or desktop; fully responsive with a retractable mobile drawer and bottom-sheet site panel.
- Deployed via Vercel; source mirrored on both GitHub and GitLab.

## The Problem

Illegal mining (*galamsey*) is one of Ghana's most urgent environmental crises. It poisons rivers, destroys farmland, and detection is almost entirely reactive — authorities and communities only find out after a river has already turned brown or a forest has already been stripped.

## The Pitch

We don't just detect galamsey after the damage is done — we **predict where it's going to spread next**, using free satellite land-cover data, community reports, and a transparent risk model.

## Quickstart

```bash
# Dashboard (works immediately — no config needed, runs in demo mode)
cd web
npm install
npm run dev        # http://localhost:3000

# Connect live data: copy web/.env.example → web/.env.local, fill in
# Supabase keys, and run supabase/migrations (0001, 0002, 0003) + supabase/seed.sql once.

# Pipeline (needs a Google Earth Engine account)
cd pipeline
pip install -r requirements.txt
earthengine authenticate
python run_pipeline.py --basin pra --dry-run
```

Repository layout and the purpose of every file: see [project_breakdown.md](project_breakdown.md). For a deep, function-by-function walkthrough of how the detection algorithm, risk scoring, report corroboration, and the officer Scan tab actually work internally, see its ["How each piece actually works"](project_breakdown.md#how-each-piece-actually-works) section.

## How It Works — Six Layers

### Layer 1 — Detection
Queries Google Earth Engine's **Dynamic World** dataset (`GOOGLE/DYNAMICWORLD/V1`) — a continuously updating, 10 m-resolution land-cover classification built on Sentinel-2 imagery, already trained and maintained by Google. Two time slices (~3 months apart) are pulled over the basin, and pixel clusters that flipped from vegetation to bare ground are flagged. Real before/after satellite photos are downloaded for every candidate site and re-hosted permanently in Supabase Storage (Earth Engine's own thumbnail links are ephemeral, so the dashboard never depends on a live Earth Engine call).

### Layer 2 — Water corroboration
Independent evidence: mean NDWI (Normalized Difference Water Index) over a 60 m river buffer near each site, before vs. after. A drop past a fixed noise threshold means the water measurably got more turbid — consistent with sediment runoff from mining — and is stored as `water_corroborated`. A missing or *positive* reading (water got clearer, not muddier) is correctly treated as **not** corroborating, never silently upgraded.

### Layer 3 — Community verification
Residents text `GALAM <locality> <what they saw>` to a phone number relayed through [httpsms](https://httpsms.com) (an Android phone + SIM exposed as an SMS API). A report lands as **pending**; it auto-upgrades to **confirmed** when satellite data corroborates it or a second independent sender reports the same spot within ~2 km. Phone numbers are HMAC-hashed before storage — raw numbers are never persisted.

Note: httpsms relays through a single physical phone, which is a real single point of failure (dead battery, lost signal, app killed) — fine for a pilot, worth revisiting (e.g. Africa's Talking) before this is depended on for real.

### Layer 4 — Predictive expansion (the differentiator)
A transparent, explainable weighted score per ~1.1 km grid cell, combining:

- Distance from confirmed sites (galamsey spreads outward along tributaries).
- Proximity to the river network.
- Proximity to forest reserve boundaries with known weak enforcement.
- Terrain accessibility / slope (machines need reachable ground).
- An optional, clamped gold-price multiplier.

No training data, no model fitting — every score's factor breakdown is stored and shown, so it's fully auditable.

### Layer 5 — Officer moderation
New automated detections and auto-corroborated reports land as `pending_review`, **not** immediately public — a satellite flag or an SMS match is evidence, not proof, and mislabeling a farm as a mine in public carries real reputational and legal risk. A signed-in officer reviews the queue at `/admin` and publishes or rejects each one. Enforced at the database level via Postgres Row Level Security, not just hidden in the UI.

### Layer 6 — Officer-requested targeted scans
The default pipeline run scans one basin's entire bounding box (~85×133km for Pra) — mostly empty land, and slow. An officer can instead request a scan of just a point + radius (100m–20km) from `/admin`'s **Scan** tab — pick a spot on the map, paste a coordinate pair, or link it directly to a pending citizen report — which queues a row in `pipeline_runs`. A scheduled GitHub Actions job drains that queue automatically every 15 minutes (`python run_pipeline.py --from-queue`; see "Automating the scan queue" below) and pushes any new sites it finds, tagged back to the request that triggered it. Deliberately scoped to detection only — it never touches the basin-wide risk grid, since naively regenerating that from a tiny search area would wipe out the real one.

## Three Surfaces, One Backend

- **Landing page** (`/`) — the public front door. What G07 does, live impact numbers, and links into the other two surfaces. No login.
- **Public map + report form** (`/map`, `/report`) — the interactive map (layer toggles, risk heatmap, before/after photos) plus a web form for reporting a site without SMS. The form requires sharing your location — no manual entry — so every web report is plotted from a real GPS fix. Only ever shows `published` sites and non-rejected reports, enforced by Row Level Security, not application logic.
- **Authority Portal** (`/login`, `/admin`) — officer/admin accounts only (EPA, Forestry Commission, task force staff), provisioned manually, no public self-signup. Adds the moderation queue, the targeted-scan request form, GeoJSON export tools, and officer annotation notes on sites.

## Progressive Web App

Installable to a phone home screen or desktop like a native app:

- Custom manifest, service worker (offline app-shell caching, network-only for API routes), and a full icon set built from a minimal gold-reticle mark.
- A custom install prompt — captures Chrome/Edge/Android's `beforeinstallprompt` event and shows Galamsey Eye's own banner; falls back to manual "Add to Home Screen" instructions on iOS, which has no such API.
- Dismissal is remembered so it never nags twice.

## Mobile Experience

Rebuilt for phone-first use, since most reporters and many officers will only ever touch this on mobile:

- **Retractable sidebar** — hidden by default on narrow screens, opened via a hamburger control, slides in over a dismissible backdrop. Desktop keeps the original permanent sidebar untouched.
- **Bottom-sheet site panel** — the before/after photo viewer slides up from the bottom edge on mobile instead of a cramped floating card, with its own scroll and a drag-handle affordance.
- Compressed header, stacked action buttons in the moderation queue, and touch-sized tap targets throughout.

## Geolocation

A "Locate me" control requests the browser's location on tap (never automatically), drops a distinct marker with an accuracy radius, and reports the distance to the nearest confirmed site and the highest-risk zone within 15 km — turning the abstract risk grid into "how close is this to me."

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 | Custom black/gold theme via CSS `@theme` tokens |
| Mapping | Leaflet | Streets/Satellite base layers, risk heatmap, geolocation control |
| Auth | Supabase Auth via `@supabase/ssr` | Cookie-based sessions, officer/admin roles, no public signup |
| Backend / DB | Supabase (Postgres + Storage) | Tables: `confirmed_sites`, `community_reports`, `risk_scores`, `profiles` |
| Data pipeline | Python + `earthengine-api`, `shapely`, `supabase-py` | Runs Earth Engine queries, uploads imagery, pushes to Supabase |
| Satellite data | Google Earth Engine (Dynamic World V1, Sentinel-2) | Free noncommercial tier |
| Community reports | httpsms.com (Android phone as SMS gateway) | Constant-time-verified webhook at `/api/reports` |
| PWA | Web App Manifest + custom service worker | Installable, offline app shell |
| Hosting | Vercel (frontend), Supabase (data + auth + storage) | Source mirrored on GitHub and GitLab |

## Data Model

Five tables in the `public` schema (see `supabase/migrations/`):

| Table | Purpose |
|---|---|
| `confirmed_sites` | Detected/reported mining sites — coordinates, area, before/after image URLs, NDWI corroboration, `review_status` (`pending_review` / `published` / `rejected`), officer notes, and the `pipeline_run_id` that found it, if any |
| `community_reports` | Reports from SMS or the web form — hashed sender (phone or IP), message, locality, status, matched site |
| `risk_scores` | The predictive grid — one row per cell with score and full factor breakdown |
| `profiles` | Officer/admin role assignments, linked to Supabase Auth users |
| `pipeline_runs` | Officer-requested targeted scans — center point, radius, status (`queued`/`running`/`done`/`failed`), sites found, optional link to the report that prompted it |

**Security model**, enforced in Postgres, not just the app:
- RLS gives anonymous/public reads **SELECT only**, and only on `published` sites — no INSERT/UPDATE/DELETE policy exists for public roles.
- Officers get a narrow, column-scoped UPDATE (`review_status`, `officer_notes`, report `status`) via a `SECURITY DEFINER` role check — never full table access.
- All other writes (the pipeline, the SMS webhook) use the service-role key, server-side only, never exposed to the browser.
- Reporter phone numbers are HMAC-SHA256-hashed before storage; the hash column is revoked from the public API entirely.
- Strict Content-Security-Policy, HTML-escaped user content in map popups, constant-time webhook secret comparison, per-sender rate limiting.

## Repository Structure

See [project_breakdown.md](project_breakdown.md) for a full file-by-file explanation.

```
project_G_07/
├── supabase/       Database migrations + seed data
├── pipeline/       Python detection/scoring pipeline
└── web/            Next.js dashboard, auth, moderation portal, SMS webhook
```

## Deployment

The web app deploys to Vercel; Supabase hosts everything else and needs no separate deployment.

1. Push to your Git remote (GitHub and/or GitLab).
2. In Vercel: New Project → import the repo → set **Root Directory to `web`** (the app isn't at the repo root).
3. Add environment variables from `web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AT_WEBHOOK_SECRET`, `REPORT_HASH_KEY`.
4. Deploy. Point httpsms's webhook (Message Received event) at `https://<your-domain>/api/reports?token=<AT_WEBHOOK_SECRET>`.

   (`AT_WEBHOOK_SECRET`'s name is a holdover from an earlier Africa's Talking integration — it's just the generic SMS-webhook shared secret now, kept as-is so no redeploy config change was needed.)

## Automating the Scan Queue

`.github/workflows/drain-pipeline-queue.yml` runs `python run_pipeline.py --from-queue` every 15 minutes so officer-requested scans (Layer 6) process automatically instead of someone running that command by hand. Earth Engine has no browser to do the interactive `earthengine authenticate` login in CI, so this uses a Google Cloud **service account** instead — set up once:

1. **Create the service account** — Google Cloud Console → IAM & Admin → Service Accounts (under the same project as `EE_PROJECT`) → Create Service Account. Any name (e.g. `g07-pipeline-ci`).
2. **Grant it Earth Engine access** — give it an Earth Engine IAM role (e.g. Earth Engine Resource Viewer) on that project, and register it for Earth Engine if prompted (Earth Engine service accounts need to be enabled for EE use, similar to how a personal account needs the initial noncommercial signup).
3. **Create a JSON key** — on that service account, Keys tab → Add Key → Create new key → JSON. This downloads a `.json` file — its full contents are the secret, not a file path.
4. **Add these as GitHub repository secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `SUPABASE_URL` — same value as `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `EE_PROJECT`
   - `EE_SERVICE_ACCOUNT_EMAIL` — the service account's email (`...@<project>.iam.gserviceaccount.com`)
   - `EE_SERVICE_ACCOUNT_KEY` — the entire JSON key file's contents, pasted as one secret

Until those secrets exist, the workflow will fail on `push.get_client()` (missing Supabase config) — harmless, since a queue with nothing in it exits before that point anyway, and no scan has been lost. `detect.py`'s `init_ee()` picks the service-account path automatically whenever both `EE_SERVICE_ACCOUNT_EMAIL`/`EE_SERVICE_ACCOUNT_KEY` are set, and falls back to the normal interactive-auth path otherwise — local/manual runs are unaffected.

## Data Sources & APIs

| Source | What it provides | Access |
|---|---|---|
| Dynamic World V1 (Earth Engine) | 10 m land-cover classification (9 classes incl. bare ground, trees, crops) | Free via Earth Engine noncommercial tier |
| Sentinel-2 (`COPERNICUS/S2_HARMONIZED`) | Raw multispectral imagery for NDWI and before/after photos | Free via Earth Engine |
| httpsms.com | SMS ingestion via an Android phone + SIM exposed as an API | Free/self-hosted-style — real phone number, no telecom approval needed |
| Ghana Forestry Commission reserve boundaries | Forest reserve boundaries, for proximity scoring | **Still a placeholder** — public GIS data pending manual sourcing |
| Gold price historical data | Optional multiplier for the risk model | **Still stubbed at neutral (1.0)** — no live feed wired in yet |

## What's Still Open

- **Forest reserve boundaries** are a labeled placeholder polygon, not official Ghana Forestry Commission data.
- **Gold-price multiplier** is stubbed neutral; no live market feed connected.
- **Whole-basin runs are still manual** (`python run_pipeline.py --basin pra`) — fine for the current cadence, since land clearing takes months to show up in a 3-month satellite comparison anyway. The officer-requested scan queue (`--from-queue`) *is* automated now, on a 15-minute GitHub Actions schedule — see "Automating the scan queue" below.
- **Targeted scans don't refresh the risk grid** — by design, to avoid a small-radius run wiping out the basin-wide grid (see Layer 6). If a targeted scan should also update nearby risk scores, that needs a proper scoped-delete, not yet built.
- **Single basin (Pra)** — the config supports two backup basins (Ankobra, Offin) but only Pra has been run for real.
- **SMS relies on one physical Android phone (httpsms)** — a real single point of failure (dead battery, lost signal, app killed). Fine for a pilot; Africa's Talking (production telecom infrastructure) is the better choice before this is depended on for real. The webhook's httpsms payload parsing also hasn't been exercised against a live message yet — see the comment in `api/reports/route.ts` if the first real report doesn't land.

## Origin: Hackathon Scope

<details>
<summary>Original 3-person, 3-week hackathon plan (kept for reference — the project has since grown past this scope)</summary>

**In scope (original MVP):** one river basin, before/after comparison over a pretrained model (no training required), a map dashboard, a simple explainable weighted risk score, seeded community reports as a fallback.

**Out of scope (by design):** national coverage, a trained/fine-tuned CV model, fully production-hardened SMS at scale, real-time continuous monitoring.

**Team roles:** Person A owned the Earth Engine pipeline; Person B owned the frontend/map; Person C owned the SMS flow, the risk heuristic, and the pitch.

**Risks identified going in:** Earth Engine approval delay, cloud cover blocking clean imagery, live SMS failing on stage, team unfamiliarity with geospatial Python, running out of time for the predictive layer — mitigated respectively by registering day 1, picking basins/dates with 2 backups, treating live SMS as a bonus not a dependency, front-loading the hardest task, and keeping the risk model deliberately simple.

**Original stretch goals:** replace the heuristic with a trained Random Forest once enough labels accumulate, expand to multiple basins nationally, live production-grade SMS with verified partnerships, automated recurring imagery pulls.

</details>

---

*Reference document derived from `Galamsey_Eye_Project_Doc.docx`.*
