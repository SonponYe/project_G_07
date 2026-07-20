"""Push pipeline outputs to Supabase.

Uses the SERVICE ROLE key (server-side secret, loaded from .env) because
RLS intentionally blocks all public writes. This module is the only writer
of confirmed_sites and risk_scores.
"""

import os
import uuid

from supabase import Client, create_client

import config


def get_client() -> Client:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Copy .env.example to .env and fill them in."
        )
    return create_client(url, key)


def _ensure_image_bucket(client: Client, bucket: str) -> None:
    """Create the image storage bucket if it doesn't exist yet, so a fresh
    Supabase project works with no manual dashboard step."""
    try:
        existing = {b.name for b in client.storage.list_buckets()}
        if bucket not in existing:
            client.storage.create_bucket(bucket, options={"public": True})
    except Exception as exc:  # noqa: BLE001 — non-fatal, uploads just fail later
        print(f"[warn] could not verify/create storage bucket '{bucket}' ({exc})")


def _upload_image(client: Client, bucket: str, path: str, data: bytes | None) -> str | None:
    """Upload image bytes to Supabase Storage and return a permanent public
    URL. Returns None (never raises) if data is missing or the upload
    fails — a missing thumbnail should never block saving the site."""
    if not data:
        return None
    try:
        client.storage.from_(bucket).upload(
            path, data, {"content-type": "image/png", "upsert": "true"}
        )
        return client.storage.from_(bucket).get_public_url(path)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] image upload failed for {path} ({exc})")
        return None


def push_sites(client: Client, sites: list[dict]) -> int:
    """Insert newly detected sites. Skips near-duplicates (~100 m) within
    the same basin, and uploads before/after images to permanent storage
    first so the dashboard never depends on a live Earth Engine link."""
    _ensure_image_bucket(client, config.SUPABASE_IMAGE_BUCKET)

    inserted = 0
    for site in sites:
        existing = (
            client.table("confirmed_sites")
            .select("id")
            .eq("basin", site["basin"])  # scope dedup to this basin only —
            # basin bboxes can overlap in lat/lng, so an unscoped check
            # could mistake a genuine new site for a duplicate elsewhere
            .gte("lat", site["lat"] - 0.001)
            .lte("lat", site["lat"] + 0.001)
            .gte("lng", site["lng"] - 0.001)
            .lte("lng", site["lng"] + 0.001)
            .execute()
        )
        if existing.data:
            continue

        site_id = uuid.uuid4().hex[:12]
        before_bytes = site.pop("before_image_bytes", None)
        after_bytes = site.pop("after_image_bytes", None)
        site["before_image_url"] = _upload_image(
            client,
            config.SUPABASE_IMAGE_BUCKET,
            f"{site['basin']}/{site_id}_before.png",
            before_bytes,
        )
        site["after_image_url"] = _upload_image(
            client,
            config.SUPABASE_IMAGE_BUCKET,
            f"{site['basin']}/{site_id}_after.png",
            after_bytes,
        )
        # New automated detections need a human officer to publish or
        # reject them from /admin — see 0002_roles_and_moderation.sql.
        # A satellite flag or auto-corroborated SMS match is evidence,
        # not proof; mislabeling a farm as a mine in public is a real risk.
        site["review_status"] = "pending_review"

        client.table("confirmed_sites").insert(site).execute()
        inserted += 1
    return inserted


def replace_risk_grid(client: Client, basin: str, rows: list[dict]) -> int:
    """Replace the risk grid for a basin atomically-enough for a demo:
    upsert on (basin, cell_id), then delete stale cells from older runs."""
    if rows:
        client.table("risk_scores").upsert(
            rows, on_conflict="basin,cell_id"
        ).execute()
    fresh_ids = [r["cell_id"] for r in rows]
    query = client.table("risk_scores").delete().eq("basin", basin)
    if fresh_ids:
        id_list = ",".join(f'"{i}"' for i in fresh_ids)
        query = query.not_.in_("cell_id", f"({id_list})")
    query.execute()
    return len(rows)
