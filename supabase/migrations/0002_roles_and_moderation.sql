-- Galamsey Eye — roles and moderation queue
--
-- Adds a lightweight role system on top of Supabase Auth so verified
-- officers (EPA, Forestry Commission, task force staff) can review new
-- automated detections before they go public, and annotate sites.
-- Public/community access remains fully read-only and unauthenticated,
-- exactly as in 0001_init.sql — this migration only adds a second,
-- narrower write path for authenticated officers, alongside the existing
-- service-role-only path used by the pipeline and SMS webhook.

-- ── Roles ───────────────────────────────────────────────────────────────
-- One row per authenticated user. Provisioned manually (create the auth
-- user in the Supabase dashboard, then insert a row here) — there is no
-- public self-signup for officer accounts, mirroring how real EPA/
-- Forestry Commission access would be granted.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer', 'officer', 'admin')),
  full_name  text,
  agency     text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Helper used by every officer-gated policy below. SECURITY DEFINER so it
-- can check role regardless of the caller's own RLS visibility (a user
-- can only SELECT their own profile row per the policy above).
create or replace function public.is_officer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('officer', 'admin')
  );
$$;

-- ── Moderation queue on confirmed_sites ────────────────────────────────
alter table public.confirmed_sites
  add column review_status text not null default 'published'
      check (review_status in ('pending_review', 'published', 'rejected')),
  add column officer_notes text;

-- Column default is 'published' for backward compatibility with existing
-- rows. Going forward, the pipeline (pipeline/push.py) inserts new
-- detections with review_status = 'pending_review' explicitly — an
-- automated satellite flag is evidence, not proof, and mislabeling a
-- legitimate farm or construction site as illegal mining in public is a
-- real reputational and legal risk. A human officer publishes or rejects
-- it from the moderation queue at /admin.

-- Public/community reads only ever see published sites.
drop policy if exists "public read sites" on public.confirmed_sites;
create policy "public read published sites" on public.confirmed_sites
  for select using (review_status = 'published');

-- Officers/admins see everything, including the review queue.
create policy "officers read all sites" on public.confirmed_sites
  for select using (public.is_officer());

-- Officers can publish/reject and annotate — never insert or delete
-- (that stays service-role only, via the pipeline).
grant update (review_status, officer_notes) on public.confirmed_sites to authenticated;
create policy "officers moderate sites" on public.confirmed_sites
  for update using (public.is_officer()) with check (public.is_officer());

-- ── Officer moderation of community reports ────────────────────────────
-- Reports already have pending/confirmed/rejected; officers can now also
-- move a report between those states by hand (e.g. reject spam, or
-- manually confirm one the auto-corroboration rule in the SMS webhook
-- didn't catch).
grant update (status) on public.community_reports to authenticated;
create policy "officers moderate reports" on public.community_reports
  for update using (public.is_officer()) with check (public.is_officer());

-- ── Backfill ────────────────────────────────────────────────────────────
-- Existing rows (seed data + any already-live sites) predate the
-- water_corroborated column's final values. Recompute from the same rule
-- pipeline/config.py uses (NDWI_DROP_THRESHOLD = -0.02): corroborated only
-- if a reading exists AND the drop is past the noise threshold.
update public.confirmed_sites
set water_corroborated = (ndwi_drop is not null and ndwi_drop < -0.02);
