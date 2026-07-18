"""Quick diagnostic: summarize NDWI coverage and check for likely
duplicate/fragmented sites in a detected-sites GeoJSON file.

Usage:
    python check_sites.py
    python check_sites.py out/pra_sites.geojson
"""

import json
import math
import sys


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else "out/pra_sites.geojson"

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    features = data["features"]
    total = len(features)
    with_ndwi = sum(1 for f in features if f["properties"]["ndwi_drop"] is not None)
    areas = [f["properties"]["area_ha"] for f in features]

    print(f"total sites: {total}")
    print(f"sites with ndwi_drop: {with_ndwi} ({with_ndwi / total:.0%})")
    print(f"area_ha range: {min(areas)} - {max(areas)}")

    # Flag sites with another site within 150m — likely fragments of the
    # same real clearing rather than genuinely separate sites.
    pts = [
        (f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0])
        for f in features
    ]
    close = 0
    for i, (lat1, lng1) in enumerate(pts):
        for lat2, lng2 in pts[i + 1 :]:
            d_m = math.hypot(
                (lat1 - lat2) * 111_320,
                (lng1 - lng2) * 111_320 * math.cos(math.radians(lat1)),
            )
            if d_m < 150:
                close += 1
                break

    print(f"sites with a neighbor within 150m: {close} of {total} ({close / total:.0%})")


if __name__ == "__main__":
    main()
