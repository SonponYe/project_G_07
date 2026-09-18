"""Layer 1 — Detection.

Compares two Dynamic World time slices over the chosen basin and flags
pixel clusters that flipped from vegetation (trees/grass/crops) to bare
ground. Returns candidate sites as GeoJSON features with centroid, area,
and before/after Sentinel-2 thumbnail URLs for the dashboard.

No model training happens here: Dynamic World is Google's pretrained,
continuously updated 10 m land-cover classification.
"""

import math
import time

import ee
import requests
from shapely.geometry import shape

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


def _thumb_bytes(composite: ee.Image, region: ee.Geometry) -> bytes | None:
    """Download a true-colour PNG thumbnail for a region as raw bytes.

    Earth Engine's getThumbURL is a live, ephemeral link — reloading it
    later means another round-trip to Earth Engine, which the dashboard
    demo must never depend on. Downloading the bytes here lets the caller
    (push.py) re-host a permanent copy instead. Returns None on any
    failure so a flaky thumbnail never takes down the whole detection run.
    """
    vis = composite.visualize(bands=["B4", "B3", "B2"], min=0, max=3000)
    url = vis.getThumbURL({"region": region, "dimensions": 512, "format": "png"})
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception as exc:  # noqa: BLE001 — any failure just omits the image
        print(f"[warn] thumbnail download failed ({exc}); site will have no image")
        return None


def _get_info_with_retry(computed_object, attempts: int = 3, delay: int = 5):
    """Call .getInfo() with a couple of retries and a short pause.

    A transient DNS/network blip shouldn't throw away a multi-minute
    Earth Engine computation that already finished server-side — only
    the final response needs to be re-fetched.
    """
    last_exc = None
    for attempt in range(attempts):
        try:
            return computed_object.getInfo()
        except Exception as exc:  # noqa: BLE001 — retry on any transient failure
            last_exc = exc
            if attempt < attempts - 1:
                print(f"[warn] Earth Engine request failed ({exc}); retrying in {delay}s…")
                time.sleep(delay)
    raise last_exc


def _local_centroid_area(geojson_polygon: dict) -> tuple[list[float], float]:
    """Compute centroid and area from an already-fetched GeoJSON polygon
    locally, instead of two extra Earth Engine round-trips per site.

    Ghana sits close to the equator (~5-8°N), where a degree of longitude
    and a degree of latitude are close enough in length that a flat
    equirectangular approximation keeps area error under ~1% — accurate
    enough for the risk model, and it removes 2 network calls per
    candidate site (534 calls across a 267-site run), which is exactly
    where a long run is most likely to hit a network hiccup.
    """
    poly = shape(geojson_polygon)
    centroid = poly.centroid
    lat_m_per_deg = 111_320
    lng_m_per_deg = 111_320 * math.cos(math.radians(centroid.y))
    area_ha = (poly.area * lat_m_per_deg * lng_m_per_deg) / 10_000
    return [centroid.x, centroid.y], area_ha


def detect_change(basin_key: str, bbox: list[float] | None = None) -> list[dict]:
    """Run vegetation→bare-ground change detection over a region.

    By default scans the named basin's full bbox. Pass `bbox` (as
    [min_lng, min_lat, max_lng, max_lat], e.g. from
    config.bbox_from_center) to scan a smaller officer-requested area
    instead — `basin_key` is still used to tag results and pick which
    basin's river/reserve data scores them, it just no longer dictates
    the search area.
    """
    basin = config.BASINS[basin_key]
    geom = ee.Geometry.Rectangle(bbox if bbox is not None else basin["bbox"])

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
    for feature in _get_info_with_retry(vectors).get("features", []):
        polygon = ee.Geometry(feature["geometry"])
        centroid, area_ha = _local_centroid_area(feature["geometry"])
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
                # Raw bytes, not URLs — push.py uploads these to permanent
                # storage (or run_pipeline.py saves them locally in
                # --dry-run mode) and swaps in a stable URL before the
                # site is written anywhere.
                "before_image_bytes": _thumb_bytes(before_composite, thumb_region),
                "after_image_bytes": _thumb_bytes(after_composite, thumb_region),
            }
        )

    return sites
