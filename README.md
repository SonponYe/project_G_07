# Galamsey Eye

**Satellite + community detection and prediction of illegal mining**

Pan-African AI Summit Hackathon 2026 — ClimateTech Track
Team of 3 · Three-week build window

## The Problem

Illegal mining (*galamsey*) is one of Ghana's most urgent environmental crises. It poisons rivers, destroys farmland, and today's detection is almost entirely reactive — authorities and communities only find out after a river has already turned brown or a forest has already been stripped.

## The Pitch

We don't just detect galamsey after the damage is done — we **predict where it's going to spread next**, using free satellite land-cover data, community reports, and a transparent risk model.

## Quickstart

```bash
# Dashboard (works immediately — no config needed, runs in demo mode)
cd web
npm install
npm run dev        # http://localhost:3000

# Connect live data: copy web/.env.example → web/.env.local, fill in
# Supabase keys, and run supabase/migrations + supabase/seed.sql once.

# Pipeline (needs Earth Engine access)
cd pipeline
pip install -r requirements.txt
earthengine authenticate
python run_pipeline.py --basin pra --dry-run
```

Repository layout and the purpose of every file: see [project_breakdown.md](project_breakdown.md).

## Scope

### In scope (MVP)

- One river basin (Pra, Ankobra, Offin, or Birim — whichever has the clearest before/after satellite signal).
- Before/after land-cover comparison over a ~3 month window, sourced from an existing pretrained model (no training required).
- A map dashboard showing confirmed sites, community reports, and a predictive risk heatmap.
- A simple, explainable weighted-scoring model for predicting expansion — not a trained ML model.
- Seeded/sample community reports rather than a fully live, production-grade SMS pipeline.

### Out of scope (by design, not a limitation)

- National coverage — one basin only.
- A trained/fine-tuned computer vision model — we use Google's existing Dynamic World model as-is.
- Fully live, production-hardened SMS/USSD reporting at scale.
- Real-time continuous monitoring — imagery comparison is a periodic snapshot, not live streaming.

## System Architecture

Four layers, building from raw signal to user-facing dashboard:

### Layer 1 — Detection (the core signal)
Query Google Earth Engine's **Dynamic World** dataset (`GOOGLE/DYNAMICWORLD/V1`) — a continuously updating, 10m-resolution land-cover classification built on Sentinel-2 imagery, already trained and maintained by Google. Two time slices (e.g. 3 months apart) are pulled over the chosen basin, and pixels that flipped from vegetation/trees/crops to bare ground are flagged, especially clusters near a riverbank. This is cross-checked with raw Sentinel-2 bands directly over river pixels — a drop in NDWI (Normalized Difference Water Index) or a shift in red/NIR reflectance indicates rising turbidity, independently corroborating the land-cover flag.

### Layer 2 — Community verification
Africa's Talking SMS/USSD lets nearby residents confirm or independently report a site. A report creates a **pending (yellow)** marker; it upgrades to **confirmed (red)** when satellite data corroborates it or a second independent report matches. This also serves as the fallback data source if satellite imagery timing doesn't cooperate before demo day.

### Layer 3 — Predictive expansion (the differentiator)
A transparent, explainable weighted score per grid cell, combining:

- Distance from confirmed sites along the river network (galamsey spreads along tributaries).
- Proximity to forest reserve boundaries with known weak enforcement.
- Terrain accessibility / slope (mining needs machine access; steep terrain is naturally protected).
- Optional multiplier: recent gold price trend, a documented correlate of galamsey activity spikes.

Produces a "risk zone for the next 60 days" heatmap layer. No training data or model fitting required — the scoring logic is fully explainable, which matters more than raw accuracy at this stage.

### Layer 4 — Dashboard
Next.js frontend reading from Supabase, map rendered with Leaflet or Mapbox GL, with toggleable layers for confirmed sites, community reports, before/after imagery, and the risk heatmap.

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind | |
| Mapping | Leaflet or Mapbox GL JS | Leaflet is free/simpler; Mapbox GL has nicer heatmap layers if time allows |
| Backend / DB | Supabase (Postgres) | Tables: `confirmed_sites`, `community_reports`, `risk_scores` |
| Data pipeline | Python + `earthengine-api` / `geemap` | Runs Earth Engine queries, exports GeoJSON, pushes to Supabase |
| Satellite data | Google Earth Engine (Dynamic World V1, Sentinel-2) | Free noncommercial tier — register early, approval isn't always instant |
| Community reports | Africa's Talking SMS/USSD API | Free-tier sandbox for testing |
| Hosting | Vercel (frontend), Supabase (data) | |

## Data Sources & APIs

| Source | What it provides | Access |
|---|---|---|
| Dynamic World V1 (Earth Engine) | Near real-time 10m land-cover classification (9 classes incl. bare ground, trees, crops) | Free via Earth Engine noncommercial tier |
| Sentinel-2 (`COPERNICUS/S2_HARMONIZED`) | Raw multispectral imagery for NDWI/turbidity calculation and visual before/after comparisons | Free via Earth Engine |
| Africa's Talking | SMS/USSD ingestion for community reports | Free-tier sandbox for testing |
| Ghana Forestry Commission reserve boundaries | Forest reserve boundary shapefiles, for proximity scoring | Public GIS data — may need manual sourcing/digitizing |
| Gold price historical data | Optional multiplier for the risk model | Public financial data APIs (e.g. metals-api) or manually sourced historical series |
| Caravan / historical streamflow (optional) | Background context if judges ask about broader hydrology | Open-source, Google-maintained |

## Team Roles

- **Person A — Data & Detection.** Earth Engine pipeline, Dynamic World queries, before/after export to Supabase. Highest-risk, most unfamiliar part — starts day 1, owned solo.
- **Person B — Frontend & Map.** Next.js/Supabase reads, Leaflet/Mapbox rendering, all UI layers. Can build against mock data from day 1 without waiting on Person A.
- **Person C — Community, Predictions & Pitch.** Africa's Talking SMS flow, the risk-scoring heuristic (simple weighted function, not a trained model), and owns the pitch deck/demo script throughout — not just at the end.

--never mind
this it too simple

## Three-Week Timeline

### Week 1 — Foundation & detection
- **Day 1–2:** Earth Engine signup/approval, Africa's Talking setup, Supabase schema design, pick the river basin.
- **Day 3–5:** Working Dynamic World query for two time periods over the chosen region; first bare-ground-change output as GeoJSON.
- **Day 6–7:** Stand up the Next.js shell with a map component rendering dummy data, so there's always something visually working to show.

### Week 2 — Integration & prediction layer
- **Day 8–10:** Wire real detection output into Supabase and onto the map; get the before/after imagery toggle working — the key visual moment for judges.
- **Day 11–12:** Build the community report flow end-to-end; seed 10–15 realistic sample reports as a safety net against live SMS unreliability.
- **Day 13–14:** Build the risk-scoring heuristic and render it as a heatmap layer.

### Week 3 — Polish, resilience, pitch
- **Day 15–17:** Handle edge cases (cloud cover gaps, empty states); tighten UI; cache a known-good dataset so the demo doesn't depend on live internet/API calls during judging.
- **Day 18–19:** Full run-through; fix what breaks; finalize the pitch deck around the before/after reveal as the hook.
- **Day 20–21:** Buffer — something in a geospatial pipeline will break close to the deadline, budget time for it.

## User Flow Scenarios

**Scenario 1 — EPA / civil society officer (primary user).** Ama, who works for an environmental watchdog, opens the dashboard and sees the river basin map. Confirmed sites appear as red markers; clicking one shows a before/after satellite comparison — forest three months ago, bare soil now. A heatmap overlay shows a predicted risk zone extending downstream from an existing site, since mining is known to spread along tributaries. She exports the highest-risk zones as a brief for a district task force.

**Scenario 2 — Community member (data contributor).** Kwabena, who lives near the river, notices new equipment moving into a forested area upstream. He sends a short SMS via the Africa's Talking short code. This creates a pending (yellow) marker on the map, which upgrades to confirmed (red) once satellite data corroborates it or a second independent report matches. No smartphone or data plan required — this is the flywheel in action: everyday residents become the sensor network.

**Scenario 3 — Judge / demo walkthrough** *(build backwards from this)*. The dashboard opens pre-loaded with seeded data. "Three months ago, this stretch of the river was forest." Click the before/after toggle — forest becomes bare soil, visually obvious with zero domain knowledge needed. Point to a community report pin nearby: "a resident flagged the same spot independently." Switch to the risk heatmap: "based on how galamsey spreads along tributaries, here's where we predict the next site within 60 days — the difference between reacting to a ruined river and getting there first." Total demo time: under 90 seconds, no machine-learning jargon required.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Earth Engine approval delay | Register on day 1, not later; have a teammate with an existing Google Cloud account try registering in parallel |
| Cloud cover blocks clean before/after imagery for the chosen dates/region | Pick the basin and date range early based on a quick manual check of image availability; have 2 backup basins in mind |
| Live SMS demo fails on stage | Rely on seeded sample reports for the main demo; treat live SMS as a bonus, not a dependency |
| Team unfamiliar with Earth Engine/Python geospatial work | Front-load this task in week 1; both other teammates build against mock data so nobody blocks on it |
| Running out of time for the predictive layer | The weighted heuristic is deliberately simple by design — it's a fallback-proof scope, not a stretch goal |

## Post-Hackathon Stretch Goals

*(Mention briefly in the pitch — don't build now.)*

- Replace the weighted heuristic with a trained Random Forest model once enough confirmed-site labels accumulate.
- Expand to multiple river basins nationally.
- Live, production-grade SMS/USSD pipeline with verified partnerships (EPA Ghana, Forestry Commission).
- Automated recurring imagery pulls instead of manual before/after snapshots.

---

*Reference document derived from `Galamsey_Eye_Project_Doc.docx`.*
