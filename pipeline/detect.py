"""Layer 1 — Detection.

Compares two Dynamic World time slices over the chosen basin and flags
pixel clusters that flipped from vegetation (trees/grass/crops) to bare
ground. Returns candidate sites as GeoJSON features with centroid, area,
and before/after Sentinel-2 thumbnail URLs for the dashboard.

No model training happens here: Dynamic World is Google's pretrained,
continuously updated 10 m land-cover classification.
"""

import ee

import config


def init_ee(project: str) -> None:
    """Authenticate + initialize Earth Engine.

    First run on a new machine requires `earthengine authenticate` once.
    """
    ee.Initialize(project=project)


def _dw_mode(geom: ee.Geometry, start: str, end: str) -> ee.Image:
    """Most common Dynamic World label per pixel over a date window."""
    return (
        ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
        .filterDate(start, end)
        .filterBounds(geom)
        .select("label")
        .mode()
    )


def _s2_composite(geom: ee.Geometry, start: str, end: str) -> ee.Image:
    """Cloud-filtered Sentinel-2 median composite for visuals + NDWI."""
    return (
        ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
        .filterDate(start, end)
        .filterBounds(geom)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", config.MAX_CLOUD_PCT))
        .median()
    )


def _thumb_url(composite: ee.Image, region: ee.Geometry) -> str:
    """True-colour PNG thumbnail URL for a region (used by dashboard)."""
    vis = composite.visualize(bands=["B4", "B3", "B2"], min=0, max=3000)
    return vis.getThumbURL({"region": region, "dimensions": 512, "format": "png"})


def detect_change(basin_key: str) -> list[dict]:
    """Run vegetation→bare-ground change detection for a basin.

    Returns a list of site dicts ready for Supabase upsert.
    """
    basin = config.BASINS[basin_key]
    geom = ee.Geometry.Rectangle(basin["bbox"])

    before = _dw_mode(geom, *config.BEFORE_WINDOW)
    after = _dw_mode(geom, *config.AFTER_WINDOW)

    # Pixels that were vegetation before...
    was_vegetation = ee.Image(0)
    for cls in config.VEGETATION_CLASSES:
        was_vegetation = was_vegetation.Or(before.eq(cls))

    # ...and are bare ground now.
    change = was_vegetation.And(after.eq(config.DW_BARE)).selfMask()

    # Drop isolated pixels: only keep connected clusters big enough
    # to be plausible mining activity rather than classification noise.
    cluster_size = change.connectedPixelCount(100, True)
    flagged = change.updateMask(cluster_size.gte(config.MIN_CLUSTER_PIXELS))

    vectors = flagged.reduceToVectors(
        geometry=geom,
        scale=10,
        geometryType="polygon",
        eightConnected=True,
        maxPixels=1e10,
        bestEffort=True,
    )

    before_composite = _s2_composite(geom, *config.BEFORE_WINDOW)
    after_composite = _s2_composite(geom, *config.AFTER_WINDOW)

    sites = []
    for feature in vectors.getInfo().get("features", []):
        polygon = ee.Geometry(feature["geometry"])
        centroid = polygon.centroid(1).coordinates().getInfo()
        area_ha = polygon.area(1).getInfo() / 10_000
        # Thumbnail window: site plus 500 m of context.
        thumb_region = polygon.buffer(500).bounds()

        sites.append(
            {
                "name": f"Detected site {centroid[1]:.4f}, {centroid[0]:.4f}",
                "lat": centroid[1],
                "lng": centroid[0],
                "area_ha": round(area_ha, 2),
                "detection_source": "satellite",
                "basin": basin_key,
                "before_image_url": _thumb_url(before_composite, thumb_region),
                "after_image_url": _thumb_url(after_composite, thumb_region),
            }
        )

    return sites
