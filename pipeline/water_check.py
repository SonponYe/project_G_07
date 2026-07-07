"""NDWI turbidity cross-check.

Independent corroboration for Layer 1: over river pixels near a candidate
site, a drop in NDWI (Normalized Difference Water Index, (B3-B8)/(B3+B8))
between the before and after windows indicates rising turbidity — the
sediment plume that dredging and washing produce. A land-cover flag plus
an NDWI drop is a much stronger signal than either alone.
"""

import ee

import config


def _mean_ndwi(point: ee.Geometry, start: str, end: str) -> float | None:
    """Mean NDWI over the river buffer around a point for a date window."""
    region = point.buffer(config.RIVER_BUFFER_M)
    composite = (
        ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
        .filterDate(start, end)
        .filterBounds(region)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", config.MAX_CLOUD_PCT))
        .median()
    )
    ndwi = composite.normalizedDifference(["B3", "B8"]).rename("ndwi")
    stats = ndwi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=region,
        scale=10,
        maxPixels=1e8,
        bestEffort=True,
    ).getInfo()
    return stats.get("ndwi")


def ndwi_drop(lat: float, lng: float) -> float | None:
    """NDWI delta (after - before) near a site. Negative = more turbid.

    Returns None when either window lacks usable imagery (e.g. clouds),
    in which case the site keeps its land-cover flag but without the
    water-quality corroboration.
    """
    point = ee.Geometry.Point([lng, lat])
    before = _mean_ndwi(point, *config.BEFORE_WINDOW)
    after = _mean_ndwi(point, *config.AFTER_WINDOW)
    if before is None or after is None:
        return None
    return round(after - before, 3)
