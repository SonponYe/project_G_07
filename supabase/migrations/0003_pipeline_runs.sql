-- Galamsey Eye — officer-requested, radius-scoped pipeline runs
--
-- Lets an officer request a targeted detection scan (a center point +
-- radius) instead of only the whole-basin runs pipeline/run_pipeline.py
-- has always supported. Solves a real problem found in production: the
-- default basin bbox is ~85x133km and mostly empty, wasting Earth Engine
-- compute — a 2km scan around a fresh citizen report is faster, cheaper,
-- and far more targeted.
--
-- This is a request QUEUE, not a live trigger — the pipeline can't run
-- inside the website itself (Vercel functions can't host a long-running
-- Python + Earth Engine job). An officer inserts a row here; the pipeline
-- drains it via `python run_pipeline.py --from-queue`, run manually for
-- now (see README).

create table public.pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles (id) on delete set null,
  center_lat   double precision not null check (center_lat between -90 and 90),
  center_lng   double precision not null check (center_lng between -180 and 180),
  radius_m     integer not null check (radius_m between 100 and 20000),
  basin        text not null default 'pra',
  label        text,                          -- short officer-given name, e.g. "Daboase tip-off"
  notes        text,                          -- longer free-text context
  report_id    uuid references public.community_reports (id) on delete set null,
                -- optional link when the run was triggered by a specific
                -- citizen report, so the officer can trace evidence back
                -- to the tip that prompted it
  status       text not null default 'queued'
               check (status in ('queued', 'running', 'done', 'failed')),
  sites_found  integer,
  error_message text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

alter table public.pipeline_runs enable row level security;

-- Officers see every run (so they can track a colleague's request too),
-- and can create new requests. Only the service role (the pipeline
-- draining the queue) updates status/results — an officer can request a
-- scan, not fake its outcome.
create policy "officers read all pipeline runs" on public.pipeline_runs
  for select using (public.is_officer());

create policy "officers create pipeline runs" on public.pipeline_runs
  for insert with check (public.is_officer() and requested_by = auth.uid());

-- ── Traceability: which run produced a given site ─────────────────────────
alter table public.confirmed_sites
  add column pipeline_run_id uuid references public.pipeline_runs (id) on delete set null;
