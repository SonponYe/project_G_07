"""Push pipeline outputs to Supabase.

Uses the SERVICE ROLE key (server-side secret, loaded from .env) because
RLS intentionally blocks all public writes. This module is the only writer
of confirmed_sites and risk_scores.
"""

import os

from supabase import Client, create_client


def get_client() -> Client:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Copy .env.example to .env and fill them in."
        )
    return create_client(url, key)


def push_sites(client: Client, sites: list[dict]) -> int:
    """Insert newly detected sites. Skips near-duplicates (~100 m)."""
    inserted = 0
    for site in sites:
        existing = (
            client.table("confirmed_sites")
            .select("id")
            .gte("lat", site["lat"] - 0.001)
            .lte("lat", site["lat"] + 0.001)
            .gte("lng", site["lng"] - 0.001)
            .lte("lng", site["lng"] + 0.001)
            .execute()
        )
        if existing.data:
            continue
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
