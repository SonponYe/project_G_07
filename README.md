# Galamsey Eye

**Satellite + community detection and prediction of illegal mining**

Originally built for the Pan-African AI Summit Hackathon 2026 (ClimateTech Track); since extended into a working system with real satellite detections, an officer moderation workflow, and a mobile-first PWA dashboard.

## Status

- **233 real illegal-mining candidate sites** detected from live Google Earth Engine data over the Pra river basin, each with genuine Sentinel-2 before/after imagery and an NDWI water-turbidity cross-check.
- **1,464-cell predictive risk grid** computed and live.
- Public dashboard + an authenticated officer moderation portal (`/admin`) both running.
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
# Supabase keys, and run supabase/migrations (0001, 0002) + supabase/seed.sql once.

# Pipeline (needs a Google Earth Engine account)
cd pipeline
pip install -r requirements.txt
earthengine authenticate
python run_pipeline.py --basin pra --dry-run
```

Repository layout and the purpose of every file: see [project_breakdown.md](project_breakdown.md).

## How It Works — Five Layers

### Layer 1 — Detection
Queries Google Earth Engine's **Dynamic World** dataset (`GOOGLE/DYNAMICWORLD/V1`) — a continuously updating, 10 m-resolution land-cover classification built on Sentinel-2 imagery, already trained and maintained by Google. Two time slices (~3 months apart) are pulled over the basin, and pixel clusters that flipped from vegetation to bare ground are flagged. Real before/after satellite photos are downloaded for every candidate site and re-hosted permanently in Supabase Storage (Earth Engine's own thumbnail links are ephemeral, so the dashboard never depends on a live Earth Engine call).

### Layer 2 — Water corroboration
Independent evidence: mean NDWI (Normalized Difference Water Index) over a 60 m river buffer near each site, before vs. after. A drop past a fixed noise threshold means the water measurably got more turbid — consistent with sediment runoff from mining — and is stored as `water_corroborated`. A missing or *positive* reading (water got clearer, not muddier) is correctly treated as **not** corroborating, never silently upgraded.

### Layer 3 — Community verification
Residents text `GALAM <locality> <what they saw>` to an Africa's Talking short code. A report lands as **pending**; it auto-upgrades to **confirmed** when satellite data corroborates it or a second independent sender reports the same spot within ~2 km. Phone numbers are HMAC-hashed before storage — raw numbers are never persisted.

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

## Two Experiences: Public vs. Authority

The same map serves two audiences with different needs, gated by role rather than duplicated code:

- **Public dashboard** (`/`) — open to anyone, no login. Friendly framing, the SMS-reporting card, map layer toggles, and the risk heatmap. Only ever shows `published` sites and non-rejected reports — enforced by Row Level Security, not application logic.
- **Authority Portal** (`/login`, `/admin`) — officer/admin accounts only (EPA, Forestry Commission, task force staff), provisioned manually, no public self-signup. Adds a moderation queue for new detections and pending reports, GeoJSON export tools, and officer annotation notes on sites.

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
| Community reports | Africa's Talking SMS/USSD API | Constant-time-verified webhook at `/api/reports` |
| PWA | Web App Manifest + custom service worker | Installable, offline app shell |
| Hosting | Vercel (frontend), Supabase (data + auth + storage) | Source mirrored on GitHub and GitLab |

## Data Model

Four tables in the `public` schema (see `supabase/migrations/`):

| Table | Purpose |
|---|---|
| `confirmed_sites` | Detected/reported mining sites — coordinates, area, before/after image URLs, NDWI corroboration, `review_status` (`pending_review` / `published` / `rejected`), officer notes |
| `community_reports` | SMS reports — hashed sender, message, locality, status, matched site |
| `risk_scores` | The predictive grid — one row per cell with score and full factor breakdown |
| `profiles` | Officer/admin role assignments, linked to Supabase Auth users |

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
4. Deploy. Point Africa's Talking's SMS callback URL at `https://<your-domain>/api/reports?token=<AT_WEBHOOK_SECRET>`.

## Data Sources & APIs

| Source | What it provides | Access |
|---|---|---|
| Dynamic World V1 (Earth Engine) | 10 m land-cover classification (9 classes incl. bare ground, trees, crops) | Free via Earth Engine noncommercial tier |
| Sentinel-2 (`COPERNICUS/S2_HARMONIZED`) | Raw multispectral imagery for NDWI and before/after photos | Free via Earth Engine |
| Africa's Talking | SMS/USSD ingestion for community reports | Sandbox for testing, production tier for real deployment |
| Ghana Forestry Commission reserve boundaries | Forest reserve boundaries, for proximity scoring | **Still a placeholder** — public GIS data pending manual sourcing |
| Gold price historical data | Optional multiplier for the risk model | **Still stubbed at neutral (1.0)** — no live feed wired in yet |

## What's Still Open

- **Forest reserve boundaries** are a labeled placeholder polygon, not official Ghana Forestry Commission data.
- **Gold-price multiplier** is stubbed neutral; no live market feed connected.
- **No automated recurring pipeline runs** — every run is manual (`python run_pipeline.py`). Fine for the current cadence (land clearing takes months to show up in a 3-month satellite comparison anyway); a scheduled job (e.g. GitHub Actions cron) would be a small addition later.
- **Single basin (Pra)** — the config supports two backup basins (Ankobra, Offin) but only Pra has been run for real.

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
