-- Galamsey Eye — demo seed data (Pra river basin, Ghana)
-- Coordinates are representative locations along the Pra and its tributaries,
-- used for the hackathon demo. Run after 0001_init.sql:
--   psql "$DATABASE_URL" -f supabase/seed.sql
-- or paste into the Supabase SQL editor.

-- ── Confirmed sites ───────────────────────────────────────────────────────
-- water_corroborated follows NDWI_DROP_THRESHOLD (-0.02 in pipeline/config.py):
-- true only when ndwi_drop is present and below that threshold. The
-- community-only site has no satellite water check, so it's false, not null.
insert into public.confirmed_sites
  (id, name, lat, lng, area_ha, detected_at, detection_source, ndwi_drop, water_corroborated, basin)
values
  ('a1000000-0000-4000-8000-000000000001', 'Twifo Praso North',   5.6410, -1.5490, 14.2, now() - interval '9 days',  'both',      -0.21, true,  'pra'),
  ('a1000000-0000-4000-8000-000000000002', 'Daboase Riverbend',   5.1620, -1.6630,  8.7, now() - interval '21 days', 'satellite', -0.14, true,  'pra'),
  ('a1000000-0000-4000-8000-000000000003', 'Beposo Floodplain',   5.0710, -1.6180, 22.5, now() - interval '34 days', 'satellite', -0.29, true,  'pra'),
  ('a1000000-0000-4000-8000-000000000004', 'Kyekyewere Tributary',5.7830, -1.4720,  5.1, now() - interval '5 days',  'community', null,  false, 'pra'),
  ('a1000000-0000-4000-8000-000000000005', 'Assin Praso West',    5.9720, -1.3910, 11.8, now() - interval '15 days', 'both',      -0.18, true,  'pra');

-- ── Community reports (phone numbers are HMAC hashes, never raw) ──────────
insert into public.community_reports
  (phone_hash, message, locality, lat, lng, status, matched_site_id, created_at)
values
  ('demo_hash_01', 'Excavator moved into forest near the river last night',        'Twifo Praso', 5.6435, -1.5461, 'confirmed', 'a1000000-0000-4000-8000-000000000001', now() - interval '10 days'),
  ('demo_hash_02', 'Water turned brown since Tuesday, machines heard upstream',    'Twifo Praso', 5.6398, -1.5512, 'confirmed', 'a1000000-0000-4000-8000-000000000001', now() - interval '9 days'),
  ('demo_hash_03', 'New pit opened behind the cocoa farms',                        'Kyekyewere',  5.7841, -1.4705, 'confirmed', 'a1000000-0000-4000-8000-000000000004', now() - interval '6 days'),
  ('demo_hash_04', 'Trucks carrying gravel out at dawn, no company sign',          'Kyekyewere',  5.7818, -1.4739, 'confirmed', 'a1000000-0000-4000-8000-000000000004', now() - interval '5 days'),
  ('demo_hash_05', 'Strange pumping sounds from the reserve edge',                 'Assin Praso', 5.9748, -1.3889, 'confirmed', 'a1000000-0000-4000-8000-000000000005', now() - interval '14 days'),
  ('demo_hash_06', 'Two changfan machines on the river near the old ferry point',  'Daboase',     5.1651, -1.6602, 'pending',   null, now() - interval '3 days'),
  ('demo_hash_07', 'Cleared patch visible from the road to Beposo',                'Beposo',      5.0742, -1.6155, 'pending',   null, now() - interval '2 days'),
  ('demo_hash_08', 'Men surveying land next to the stream, say they have permit',  'Wassa Nkonya',5.3210, -1.7040, 'pending',   null, now() - interval '2 days'),
  ('demo_hash_09', 'River fish dying near the bend, oily film on water',           'Daboase',     5.1590, -1.6660, 'pending',   null, now() - interval '1 day'),
  ('demo_hash_10', 'Generator running all night in the forest across the river',   'Twifo Praso', 5.6480, -1.5430, 'pending',   null, now() - interval '20 hours'),
  ('demo_hash_11', 'New access road being cut toward the reserve boundary',        'Assin Praso', 5.9690, -1.3950, 'pending',   null, now() - interval '12 hours'),
  ('demo_hash_12', 'Excavator offloaded from truck at junction, heading east',     'Beposo',      5.0690, -1.6210, 'pending',   null, now() - interval '6 hours');

-- ── Risk grid (normally produced by pipeline/risk.py; seeded for demo) ────
insert into public.risk_scores (cell_id, basin, lat, lng, cell_deg, score, factors, window_days)
values
  ('pra_5.63_-1.56', 'pra', 5.63, -1.56, 0.01, 0.91, '{"site_proximity":0.95,"river_proximity":0.92,"reserve_proximity":0.80,"slope_access":0.94,"gold_multiplier":1.0}', 60),
  ('pra_5.62_-1.55', 'pra', 5.62, -1.55, 0.01, 0.87, '{"site_proximity":0.90,"river_proximity":0.95,"reserve_proximity":0.72,"slope_access":0.90,"gold_multiplier":1.0}', 60),
  ('pra_5.65_-1.54', 'pra', 5.65, -1.54, 0.01, 0.83, '{"site_proximity":0.88,"river_proximity":0.85,"reserve_proximity":0.75,"slope_access":0.82,"gold_multiplier":1.0}', 60),
  ('pra_5.66_-1.53', 'pra', 5.66, -1.53, 0.01, 0.74, '{"site_proximity":0.78,"river_proximity":0.80,"reserve_proximity":0.68,"slope_access":0.70,"gold_multiplier":1.0}', 60),
  ('pra_5.60_-1.57', 'pra', 5.60, -1.57, 0.01, 0.68, '{"site_proximity":0.72,"river_proximity":0.75,"reserve_proximity":0.55,"slope_access":0.71,"gold_multiplier":1.0}', 60),
  ('pra_5.79_-1.46', 'pra', 5.79, -1.46, 0.01, 0.82, '{"site_proximity":0.92,"river_proximity":0.70,"reserve_proximity":0.85,"slope_access":0.80,"gold_multiplier":1.0}', 60),
  ('pra_5.78_-1.48', 'pra', 5.78, -1.48, 0.01, 0.77, '{"site_proximity":0.85,"river_proximity":0.72,"reserve_proximity":0.78,"slope_access":0.75,"gold_multiplier":1.0}', 60),
  ('pra_5.77_-1.47', 'pra', 5.77, -1.47, 0.01, 0.71, '{"site_proximity":0.80,"river_proximity":0.68,"reserve_proximity":0.70,"slope_access":0.68,"gold_multiplier":1.0}', 60),
  ('pra_5.98_-1.38', 'pra', 5.98, -1.38, 0.01, 0.79, '{"site_proximity":0.88,"river_proximity":0.74,"reserve_proximity":0.82,"slope_access":0.72,"gold_multiplier":1.0}', 60),
  ('pra_5.96_-1.40', 'pra', 5.96, -1.40, 0.01, 0.73, '{"site_proximity":0.82,"river_proximity":0.76,"reserve_proximity":0.66,"slope_access":0.70,"gold_multiplier":1.0}', 60),
  ('pra_5.95_-1.38', 'pra', 5.95, -1.38, 0.01, 0.66, '{"site_proximity":0.74,"river_proximity":0.70,"reserve_proximity":0.60,"slope_access":0.62,"gold_multiplier":1.0}', 60),
  ('pra_5.17_-1.65', 'pra', 5.17, -1.65, 0.01, 0.75, '{"site_proximity":0.84,"river_proximity":0.88,"reserve_proximity":0.50,"slope_access":0.78,"gold_multiplier":1.0}', 60),
  ('pra_5.15_-1.67', 'pra', 5.15, -1.67, 0.01, 0.69, '{"site_proximity":0.76,"river_proximity":0.82,"reserve_proximity":0.48,"slope_access":0.74,"gold_multiplier":1.0}', 60),
  ('pra_5.08_-1.61', 'pra', 5.08, -1.61, 0.01, 0.81, '{"site_proximity":0.90,"river_proximity":0.86,"reserve_proximity":0.58,"slope_access":0.85,"gold_multiplier":1.0}', 60),
  ('pra_5.06_-1.62', 'pra', 5.06, -1.62, 0.01, 0.72, '{"site_proximity":0.80,"river_proximity":0.84,"reserve_proximity":0.52,"slope_access":0.76,"gold_multiplier":1.0}', 60),
  ('pra_5.09_-1.63', 'pra', 5.09, -1.63, 0.01, 0.64, '{"site_proximity":0.70,"river_proximity":0.78,"reserve_proximity":0.50,"slope_access":0.66,"gold_multiplier":1.0}', 60),
  ('pra_5.44_-1.62', 'pra', 5.44, -1.62, 0.01, 0.55, '{"site_proximity":0.58,"river_proximity":0.72,"reserve_proximity":0.44,"slope_access":0.60,"gold_multiplier":1.0}', 60),
  ('pra_5.33_-1.68', 'pra', 5.33, -1.68, 0.01, 0.49, '{"site_proximity":0.50,"river_proximity":0.66,"reserve_proximity":0.40,"slope_access":0.55,"gold_multiplier":1.0}', 60),
  ('pra_5.52_-1.59', 'pra', 5.52, -1.59, 0.01, 0.58, '{"site_proximity":0.62,"river_proximity":0.74,"reserve_proximity":0.42,"slope_access":0.64,"gold_multiplier":1.0}', 60),
  ('pra_5.70_-1.51', 'pra', 5.70, -1.51, 0.01, 0.61, '{"site_proximity":0.66,"river_proximity":0.70,"reserve_proximity":0.52,"slope_access":0.62,"gold_multiplier":1.0}', 60);
