"""Galamsey Eye pipeline orchestrator.

Usage:
  python run_pipeline.py --basin pra                 # full run → Supabase
  python run_pipeline.py --basin pra --dry-run       # write GeoJSON to out/, no DB writes
  python run_pipeline.py --basin pra --skip-detect   # risk grid only (reuses DB sites)

First-time setup:
  pip install -r requirements.txt
  earthengine authenticate
  cp ../.env.example ../.env   (then fill in keys)
"""

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv

import config
import risk

OUT_DIR = Path(__file__).parent / "out"


def build_slope_lookup(basin_key: str):
    """Sample SRTM slope over the basin grid in one Earth Engine call and
    return a lookup function. Falls back to None (neutral slope factor in
    risk.py) if Earth Engine is unavailable — the demo must never block
    on a live API."""
    try:
        import ee

        basin = config.BASINS[basin_key]
        geom = ee.Geometry.Rectangle(basin["bbox"])
        slope_img = ee.Terrain.slope(ee.Image("USGS/SRTMGL1_003"))
        # Sample at grid resolution; build a dict keyed by rounded coords.
        sample = slope_img.sample(
            region=geom,
            scale=config.GRID_CELL_DEG * 111_320,  # deg → metres
            geometries=True,
        ).getInfo()
        table = {}
        for feat in sample.get("features", []):
            lng, lat = feat["geometry"]["coordinates"]
            table[(round(lat, 2), round(lng, 2))] = feat["properties"].get("slope")

        def lookup(lat: float, lng: float):
            return table.get((round(lat, 2), round(lng, 2)))

        return lookup
    except Exception as exc:  # noqa: BLE001 — any EE failure means fallback
        print(f"[warn] slope lookup unavailable ({exc}); using neutral slope factor")
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Galamsey Eye data pipeline")
    parser.add_argument("--basin", default=config.DEFAULT_BASIN, choices=config.BASINS)
    parser.add_argument("--dry-run", action="store_true", help="write out/ files, no DB")
    parser.add_argument("--skip-detect", action="store_true", help="risk grid only")
    args = parser.parse_args()

    # Load secrets from repo-root .env (never hardcoded).
    load_dotenv(Path(__file__).parent.parent / ".env")

    sites: list[dict] = []

    if not args.skip_detect:
        import detect
        import water_check

        detect.init_ee(os.environ.get("EE_PROJECT") or None)
        print(f"[1/3] Detecting land-cover change in {args.basin}…")
        sites = detect.detect_change(args.basin)
        print(f"      {len(sites)} candidate site(s) found")

        print("[2/3] Cross-checking river turbidity (NDWI)…")
        for site in sites:
            site["ndwi_drop"] = water_check.ndwi_drop(site["lat"], site["lng"])

    if args.skip_detect and not args.dry_run:
        # Reuse already-confirmed sites from the DB as risk anchors.
        import push

        client = push.get_client()
        result = (
            client.table("confirmed_sites")
            .select("lat,lng")
            .eq("basin", args.basin)
            .execute()
        )
        sites = result.data or []

    print("[3/3] Scoring expansion risk grid…")
    slope_lookup = build_slope_lookup(args.basin) if not args.dry_run else None
    grid = risk.score_grid(args.basin, sites, slope_lookup)
    print(f"      {len(grid)} cells above threshold")

    if args.dry_run:
        OUT_DIR.mkdir(exist_ok=True)
        (OUT_DIR / f"{args.basin}_sites.geojson").write_text(
            json.dumps(_to_geojson(sites, "site"), indent=2), encoding="utf-8"
        )
        (OUT_DIR / f"{args.basin}_risk.geojson").write_text(
            json.dumps(_to_geojson(grid, "risk"), indent=2), encoding="utf-8"
        )
        print(f"Dry run complete → {OUT_DIR}")
        return

    import push

    client = push.get_client()
    if sites and not args.skip_detect:
        n = push.push_sites(client, sites)
        print(f"Pushed {n} new site(s) to Supabase")
    n = push.replace_risk_grid(client, args.basin, grid)
    print(f"Risk grid updated: {n} cells")


def _to_geojson(rows: list[dict], kind: str) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
                "properties": {k: v for k, v in r.items() if k not in ("lat", "lng")}
                | {"kind": kind},
            }
            for r in rows
        ],
    }


if __name__ == "__main__":
    main()
