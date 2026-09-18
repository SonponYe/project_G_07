"""Central configuration for the Galamsey Eye data pipeline.

Everything tunable lives here: basin geometry, date windows, detection
thresholds, and the risk-model weights. The weights are deliberately
visible and documented — the risk model is a transparent heuristic,
and judges/stakeholders should be able to read this file and understand it.
"""

# ── Basins (bounding boxes: [min_lng, min_lat, max_lng, max_lat]) ─────────
# Primary basin plus two backups in case cloud cover blocks clean imagery.
BASINS = {
    "pra": {
        "name": "Pra River Basin",
        "bbox": [-2.05, 4.95, -1.20, 6.15],
        "river_geojson": "data/pra_river.geojson",
    },
    "ankobra": {
        "name": "Ankobra River Basin",
        "bbox": [-2.55, 4.85, -1.95, 6.05],
        "river_geojson": None,  # backup basin — digitize if needed
    },
    "offin": {
        "name": "Offin River Basin",
        "bbox": [-2.20, 5.90, -1.55, 6.75],
        "river_geojson": None,  # backup basin — digitize if needed
    },
}

DEFAULT_BASIN = "pra"

# ── Detection windows (before vs after, ~3 months apart) ─────────────────
BEFORE_WINDOW = ("2026-03-01", "2026-04-01")
AFTER_WINDOW = ("2026-06-01", "2026-07-01")

# ── Dynamic World label classes (GOOGLE/DYNAMICWORLD/V1) ─────────────────
DW_WATER = 0
DW_TREES = 1
DW_GRASS = 2
DW_FLOODED_VEG = 3
DW_CROPS = 4
DW_SHRUB = 5
DW_BUILT = 6
DW_BARE = 7
DW_SNOW = 8

# Vegetation classes whose flip to bare ground we flag.
VEGETATION_CLASSES = [DW_TREES, DW_GRASS, DW_CROPS]

# Minimum connected pixels (10 m each) to count as a site — filters noise.
# 8 px at 10 m resolution ~ 0.08 ha of contiguous change.
MIN_CLUSTER_PIXELS = 8

# Max cloud percentage for Sentinel-2 scenes used in composites/thumbnails.
# Was 20 — too strict here, since CLOUDY_PIXEL_PERCENTAGE is a whole-tile
# average (~100x100km), not a per-site value. A cloud bank anywhere in a
# huge tile could exclude the entire scene even when the site itself was
# clear, which was silently zeroing out NDWI coverage basin-wide. 50
# confirmed working against real Pra basin data (see test_ndwi.py).
MAX_CLOUD_PCT = 50

# River buffer (metres) for NDWI turbidity cross-check.
RIVER_BUFFER_M = 60

# NDWI values this small in magnitude are within normal noise (seasonal
# flow variation, sensor/atmospheric variation between passes) and
# shouldn't be read as real turbidity change either way. Only a drop
# below this counts as the water check corroborating the land-cover
# flag — see water_corroborated in run_pipeline.py.
NDWI_DROP_THRESHOLD = -0.02

# ── Risk model (Layer 3) — transparent weighted heuristic ─────────────────
# Grid resolution in degrees (~1.1 km cells).
GRID_CELL_DEG = 0.01

# Weights must sum to 1.0. Each factor is normalised to [0, 1].
RISK_WEIGHTS = {
    "site_proximity": 0.35,    # galamsey spreads outward from existing sites
    "river_proximity": 0.25,   # spreads along the river network/tributaries
    "reserve_proximity": 0.20, # forest reserves with weak enforcement attract it
    "slope_access": 0.20,      # machinery needs flat, accessible terrain
}

# Exponential decay length scales (km) for the distance-based factors.
SITE_DECAY_KM = 5.0
RIVER_DECAY_KM = 2.0
RESERVE_DECAY_KM = 3.0

# Slope above which terrain is considered inaccessible to machinery (degrees).
MAX_ACCESSIBLE_SLOPE_DEG = 25.0

# Prediction horizon shown on the dashboard.
RISK_WINDOW_DAYS = 60

# Keep only cells above this score to avoid flooding the DB with noise.
MIN_SCORE_TO_STORE = 0.30

# Forest reserve boundaries (Ghana Forestry Commission; manually digitized
# placeholder until official shapefiles are sourced).
FOREST_RESERVES_GEOJSON = "data/forest_reserves.geojson"

# ── Site imagery ───────────────────────────────────────────────────────────
# Supabase Storage bucket for permanent before/after thumbnails. Earth
# Engine's getThumbURL links are ephemeral and require a live call to
# reload, so the pipeline downloads the bytes once and re-hosts them here —
# the dashboard/demo should never depend on a live Earth Engine request.
SUPABASE_IMAGE_BUCKET = "site-images"

# ── Officer-requested, radius-scoped runs ───────────────────────────────────
_METERS_PER_DEG_LAT = 111_320  # ~constant everywhere


def bbox_from_center(lat: float, lng: float, radius_m: float) -> list[float]:
    """[min_lng, min_lat, max_lng, max_lat] for a circle's bounding square,
    used for officer-requested targeted scans (a point + radius) instead of
    a whole named basin. Longitude degrees shrink with latitude — a fixed
    111,320 m/deg only holds for latitude, so it's corrected by cos(lat)
    here, same approximation already used in detect.py/risk.py (Ghana's
    ~5-8°N keeps the error under ~1%).
    """
    import math

    deg_lat = radius_m / _METERS_PER_DEG_LAT
    deg_lng = radius_m / (_METERS_PER_DEG_LAT * math.cos(math.radians(lat)))
    return [lng - deg_lng, lat - deg_lat, lng + deg_lng, lat + deg_lat]
