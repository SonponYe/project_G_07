"""Layer 3 — Predictive expansion risk (the differentiator).

A transparent, explainable weighted score per grid cell. NOT a trained
model: every factor is a documented, physically-motivated heuristic, and
the per-cell factor breakdown is stored alongside the score so the
dashboard (and a judge) can see exactly why a cell is red.

Factors:
  site_proximity     — exp decay with distance to nearest confirmed site
  river_proximity    — exp decay with distance to the river network
  reserve_proximity  — exp decay with distance to forest reserve boundaries
  slope_access       — flat terrain is machine-accessible (1 - slope/max)

Optional multiplier: recent gold price trend (documented correlate of
galamsey spikes), supplied via GOLD_TREND_MULTIPLIER env var.
"""

import json
import math
import os
from pathlib import Path

from shapely.geometry import Point, shape

import config

_EARTH_KM_PER_DEG = 111.32  # good enough near the equator (Ghana ~5-6°N)


def _load_geojson_geoms(path: str):
    """Load geometries from a GeoJSON file bundled with the pipeline."""
    full_path = Path(__file__).parent / path
    if not full_path.exists():
        return []
    with open(full_path, encoding="utf-8") as fh:
        data = json.load(fh)
    return [shape(feat["geometry"]) for feat in data.get("features", [])]


def _km_to_nearest(point: Point, geoms) -> float | None:
    """Approximate distance in km from a point to the nearest geometry."""
    if not geoms:
        return None
    deg = min(point.distance(g) for g in geoms)
    return deg * _EARTH_KM_PER_DEG


def _decay(distance_km: float | None, scale_km: float) -> float:
    """exp(-d/scale) → 1.0 at the feature, ~0 far away. 0 if unknown."""
    if distance_km is None:
        return 0.0
    return math.exp(-distance_km / scale_km)


def _slope_access(lat: float, lng: float, slope_lookup) -> float:
    """Accessibility from terrain slope. slope_lookup may be None (fallback
    to neutral 0.7) or a callable returning slope in degrees (from SRTM
    via Earth Engine — see run_pipeline.build_slope_lookup)."""
    if slope_lookup is None:
        return 0.7
    slope_deg = slope_lookup(lat, lng)
    if slope_deg is None:
        return 0.7
    return max(0.0, 1.0 - slope_deg / config.MAX_ACCESSIBLE_SLOPE_DEG)


def score_grid(basin_key: str, confirmed_sites: list[dict], slope_lookup=None) -> list[dict]:
    """Score every grid cell in the basin bbox. Returns risk_scores rows."""
    basin = config.BASINS[basin_key]
    min_lng, min_lat, max_lng, max_lat = basin["bbox"]
    cell = config.GRID_CELL_DEG

    river_geoms = (
        _load_geojson_geoms(basin["river_geojson"]) if basin["river_geojson"] else []
    )
    reserve_geoms = _load_geojson_geoms(config.FOREST_RESERVES_GEOJSON)
    site_points = [Point(s["lng"], s["lat"]) for s in confirmed_sites]

    gold_multiplier = float(os.environ.get("GOLD_TREND_MULTIPLIER", "1.0"))
    # Sanity-clamp: a market signal should nudge, never dominate.
    gold_multiplier = min(max(gold_multiplier, 0.8), 1.3)

    # Step by integer indices rather than repeatedly adding `cell` to a
    # float accumulator: across a basin-sized bbox that's hundreds of
    # additions, and the accumulated floating-point drift occasionally
    # pushes a cell's lat/lng across a rounding boundary, making two
    # genuinely distinct cells format to the identical cell_id string
    # (observed: 51 collisions out of 1148 cells on a real Pra run) and
    # crashing the upsert with a duplicate-key error. Indices are exact.
    n_lat = int((max_lat - min_lat) / cell)
    n_lng = int((max_lng - min_lng) / cell)

    rows = []
    for i in range(n_lat):
        lat = min_lat + cell / 2 + i * cell
        for j in range(n_lng):
            lng = min_lng + cell / 2 + j * cell
            point = Point(lng, lat)

            factors = {
                "site_proximity": _decay(
                    _km_to_nearest(point, site_points), config.SITE_DECAY_KM
                ),
                "river_proximity": _decay(
                    _km_to_nearest(point, river_geoms), config.RIVER_DECAY_KM
                ),
                "reserve_proximity": _decay(
                    _km_to_nearest(point, reserve_geoms), config.RESERVE_DECAY_KM
                ),
                "slope_access": _slope_access(lat, lng, slope_lookup),
            }

            base = sum(config.RISK_WEIGHTS[k] * v for k, v in factors.items())
            score = min(base * gold_multiplier, 1.0)

            if score >= config.MIN_SCORE_TO_STORE:
                factors_out = {k: round(v, 2) for k, v in factors.items()}
                factors_out["gold_multiplier"] = gold_multiplier
                rows.append(
                    {
                        # Built from the exact integer grid indices, not
                        # formatted floats: every cell center sits exactly
                        # on a `.2f` rounding boundary (cell/2 offset with
                        # a 0.01 cell size means the 3rd decimal is always
                        # "5"), which binary floating point can round
                        # either way per-cell — collisions there previously
                        # crashed the upsert with a duplicate-key error.
                        "cell_id": f"{basin_key}_{i}_{j}",
                        "basin": basin_key,
                        "lat": round(lat, 4),
                        "lng": round(lng, 4),
                        "cell_deg": cell,
                        "score": round(score, 3),
                        "factors": factors_out,
                        "window_days": config.RISK_WINDOW_DAYS,
                    }
                )

    return rows
