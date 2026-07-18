-- Galamsey Eye — initial schema
-- Security model:
--   * anon / authenticated roles: READ ONLY (RLS select policies below).
--   * All writes go through the service role (Python pipeline + Next.js
--     API routes), which bypasses RLS by design. No insert/update/delete
--     policy exists for public roles, so client-side writes are impossible.

create extension if not exists pgcrypto;

-- ── Confirmed illegal-mining sites (satellite- or community-verified) ─────
create table public.confirmed_sites (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  lat              double precision not null check (lat between -90 and 90),
  lng              double precision not null check (lng between -180 and 180),
  area_ha          double precision check (area_ha >= 0),
  detected_at      timestamptz not null default now(),
  detection_source text not null default 'satellite'
                   check (detection_source in ('satellite', 'community', 'both')),
  ndwi_drop        double precision,          -- turbidity corroboration signal
  water_corroborated boolean not null default false,
                   -- true only if ndwi_drop is present AND below the noise
                   -- threshold (NDWI_DROP_THRESHOLD in pipeline/config.py).
                   -- A missing reading or a rise/flat reading is NOT
                   -- corroboration — don't treat "ndwi_drop is not null"
                   -- as confirmation anywhere downstream.
  before_image_url text,                      -- permanent Supabase Storage URL (before window)
  after_image_url  text,                      -- permanent Supabase Storage URL (after window)
  basin            text not null default 'pra',
  created_at       timestamptz not null default now()
);

-- ── Community SMS/USSD reports ────────────────────────────────────────────
create table public.community_reports (
  id              uuid primary key default gen_random_uuid(),
  phone_hash      text not null,              -- HMAC-SHA256 of sender; raw number never stored
  message         text not null check (char_length(message) <= 500),
  locality        text,
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'rejected')),
  matched_site_id uuid references public.confirmed_sites (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ── Predictive risk grid (weighted heuristic output) ──────────────────────
create table public.risk_scores (
  id           uuid primary key default gen_random_uuid(),
  cell_id      text not null,                 -- stable grid id, e.g. "pra_5.61_-1.55"
  basin        text not null default 'pra',
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  cell_deg     double precision not null default 0.01,  -- cell edge length in degrees
  score        double precision not null check (score between 0 and 1),
  factors      jsonb not null default '{}'::jsonb,      -- explainable breakdown
  window_days  integer not null default 60,
  computed_at  timestamptz not null default now(),
  unique (basin, cell_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index idx_sites_basin on public.confirmed_sites (basin);
create index idx_reports_status on public.community_reports (status);
create index idx_reports_phone_hash on public.community_reports (phone_hash);
create index idx_risk_basin_score on public.risk_scores (basin, score desc);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.confirmed_sites  enable row level security;
alter table public.community_reports enable row level security;
alter table public.risk_scores      enable row level security;

-- Public dashboard is read-only for everyone.
create policy "public read sites"   on public.confirmed_sites   for select using (true);
create policy "public read reports" on public.community_reports for select using (true);
create policy "public read risk"    on public.risk_scores       for select using (true);

-- Intentionally NO insert/update/delete policies: only the service role
-- (used by the pipeline and the SMS webhook API route) can write.

-- Extra hardening: phone_hash is the most sensitive column; hide it from
-- the anon API surface entirely.
revoke select (phone_hash) on public.community_reports from anon, authenticated;
