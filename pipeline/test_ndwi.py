"""Quickly test different cloud-cover/date-window settings for the NDWI
water-corroboration check, against sites already saved in a GeoJSON file —
without re-running the slow, multi-minute detection step.

Usage:
    python test_ndwi.py                     # test first 10 sites, default settings
    python test_ndwi.py --n 20              # test first 20 sites
    python test_ndwi.py --cloud-pct 40      # try a looser cloud filter
    python test_ndwi.py --after-start 2026-05-15 --after-end 2026-07-15
"""

import argparse
import json
import os
from pathlib import Path

import ee
from dotenv import load_dotenv

import config
import detect
import water_check


def main() -> None:
    load_dotenv(Path(__file__).parent.parent / ".env")

    parser = argparse.ArgumentParser()
    parser.add_argument("--sites-file", default="out/pra_sites.geojson")
    parser.add_argument("--n", type=int, default=10, help="how many sites to test")
    parser.add_argument("--cloud-pct", type=float, default=config.MAX_CLOUD_PCT)
    parser.add_argument("--after-start", default=config.AFTER_WINDOW[0])
    parser.add_argument("--after-end", default=config.AFTER_WINDOW[1])
    args = parser.parse_args()

    # Apply overrides for this test run only — doesn't touch config.py.
    config.MAX_CLOUD_PCT = args.cloud_pct
    config.AFTER_WINDOW = (args.after_start, args.after_end)

    detect.init_ee(os.environ.get("EE_PROJECT") or None)

    with open(args.sites_file, encoding="utf-8") as f:
        data = json.load(f)

    features = data["features"][: args.n]
    print(f"Testing {len(features)} site(s) — cloud_pct<{args.cloud_pct}, "
          f"after window {args.after_start} to {args.after_end}\n")

    hits = 0
    for feat in features:
        lng, lat = feat["geometry"]["coordinates"]
        drop = water_check.ndwi_drop(lat, lng)
        status = "OK" if drop is not None else "no imagery"
        print(f"  ({lat:.4f}, {lng:.4f})  ndwi_drop={drop}  [{status}]")
        if drop is not None:
            hits += 1

    print(f"\n{hits} of {len(features)} sites got a real NDWI reading.")


if __name__ == "__main__":
    main()
