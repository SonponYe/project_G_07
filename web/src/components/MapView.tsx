"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

import { haversineKm, nearest } from "@/lib/geo";
import type {
  CommunityReport,
  ConfirmedSite,
  LayerVisibility,
  RiskCell,
} from "@/lib/types";

import { IconLocate } from "./icons";

interface MapViewProps {
  sites: ConfirmedSite[];
  reports: CommunityReport[];
  riskCells: RiskCell[];
  layers: LayerVisibility;
  selectedSiteId: string | null;
  onSelectSite: (site: ConfirmedSite) => void;
}

const PRA_CENTER: L.LatLngExpression = [5.55, -1.55];

function riskColor(score: number): string {
  if (score >= 0.8) return "#dc2626"; // red-600 — imminent
  if (score >= 0.65) return "#e5893a"; // burnt orange
  if (score >= 0.5) return "#d4af37"; // gold-500
  return "#8a6d21"; // gold-700, muted
}

export default function MapView({
  sites,
  reports,
  riskCells,
  layers,
  selectedSiteId,
  onSelectSite,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<{
    sites: L.LayerGroup;
    reports: L.LayerGroup;
    risk: L.LayerGroup;
    locate: L.LayerGroup;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: PRA_CENTER,
      zoom: 9,
      zoomControl: true,
    });

    const streets = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(map);

    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, attribution: "Tiles &copy; Esri" }
    );

    L.control
      .layers({ Streets: streets, Satellite: satellite }, undefined, {
        position: "bottomright",
      })
      .addTo(map);

    groupsRef.current = {
      risk: L.layerGroup().addTo(map),
      sites: L.layerGroup().addTo(map),
      reports: L.layerGroup().addTo(map),
      locate: L.layerGroup().addTo(map),
    };
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      groupsRef.current = null;
    };
  }, []);

  // Redraw data layers when data / visibility / selection changes.
  useEffect(() => {
    const map = mapRef.current;
    const groups = groupsRef.current;
    if (!map || !groups) return;

    groups.risk.clearLayers();
    groups.sites.clearLayers();
    groups.reports.clearLayers();

    if (layers.risk) {
      for (const cellData of riskCells) {
        const half = cellData.cellDeg / 2;
        L.rectangle(
          [
            [cellData.lat - half, cellData.lng - half],
            [cellData.lat + half, cellData.lng + half],
          ],
          {
            color: riskColor(cellData.score),
            weight: 0,
            fillOpacity: 0.25 + cellData.score * 0.35,
          }
        )
          .bindTooltip(
            `Risk ${(cellData.score * 100).toFixed(0)}% (next ${cellData.windowDays} days)<br/>` +
              `site proximity ${fmt(cellData.factors.site_proximity)} · river ${fmt(cellData.factors.river_proximity)}<br/>` +
              `reserve ${fmt(cellData.factors.reserve_proximity)} · terrain ${fmt(cellData.factors.slope_access)}`,
            { sticky: true }
          )
          .addTo(groups.risk);
      }
    }

    if (layers.reports) {
      for (const report of reports) {
        if (report.lat == null || report.lng == null) continue;
        const confirmed = report.status === "confirmed";
        L.circleMarker([report.lat, report.lng], {
          radius: 6,
          color: confirmed ? "#dc2626" : "#d4af37",
          fillColor: confirmed ? "#ef4444" : "#e5c158",
          fillOpacity: 0.85,
          weight: 1.5,
        })
          .bindPopup(
            `<b>${confirmed ? "Confirmed" : "Pending"} community report</b><br/>` +
              `${escapeHtml(report.message)}<br/>` +
              `<small>${escapeHtml(report.locality ?? "unknown locality")} · ${new Date(report.createdAt).toLocaleDateString()}</small>`
          )
          .addTo(groups.reports);
      }
    }

    if (layers.sites) {
      for (const site of sites) {
        const selected = site.id === selectedSiteId;
        const pending = site.reviewStatus === "pending_review";
        L.circleMarker([site.lat, site.lng], {
          radius: selected ? 12 : 9,
          color: pending ? "#8a6d21" : "#7f1d1d",
          fillColor: pending ? "#e5c158" : "#dc2626",
          fillOpacity: pending ? 0.6 : 0.95,
          weight: selected ? 3 : 2,
          dashArray: pending ? "3,2" : undefined,
        })
          .bindTooltip(pending ? `${site.name} — pending review` : site.name)
          .on("click", () => onSelectSite(site))
          .addTo(groups.sites);
      }
    }
  }, [sites, reports, riskCells, layers, selectedSiteId, onSelectSite]);

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocateError("Location isn't supported on this device.");
      return;
    }
    setLocating(true);
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        const map = mapRef.current;
        const groups = groupsRef.current;
        if (!map || !groups) return;

        groups.locate.clearLayers();

        const nearestSite = nearest(
          { lat, lng },
          sites,
          (s) => ({ lat: s.lat, lng: s.lng })
        );
        const nearestRisk = nearest(
          { lat, lng },
          riskCells,
          (c) => ({ lat: c.lat, lng: c.lng })
        );
        // Highest-scoring risk cell within 15 km — more actionable than
        // just "nearest cell," which could be a low-risk one right next door.
        const nearbyHighRisk = riskCells
          .filter((c) => haversineKm(lat, lng, c.lat, c.lng) <= 15)
          .sort((a, b) => b.score - a.score)[0];

        const lines = [`<b>You are here</b>`, `Accuracy: ±${Math.round(accuracy)} m`];
        if (nearestSite) {
          lines.push(
            `Nearest reported site: <b>${nearestSite.distanceKm.toFixed(1)} km</b> (${escapeHtml(
              nearestSite.item.name
            )})`
          );
        }
        if (nearbyHighRisk) {
          lines.push(
            `Highest nearby risk: <b>${(nearbyHighRisk.score * 100).toFixed(0)}%</b> ` +
              `(${haversineKm(lat, lng, nearbyHighRisk.lat, nearbyHighRisk.lng).toFixed(1)} km away)`
          );
        } else if (nearestRisk) {
          lines.push(`No elevated risk zones within 15 km.`);
        }

        L.circle([lat, lng], {
          radius: accuracy,
          color: "#7dd3fc",
          fillColor: "#7dd3fc",
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(groups.locate);

        L.circleMarker([lat, lng], {
          radius: 8,
          color: "#0a0a0a",
          fillColor: "#7dd3fc",
          fillOpacity: 1,
          weight: 2,
        })
          .bindPopup(lines.join("<br/>"))
          .addTo(groups.locate)
          .openPopup();

        map.flyTo([lat, lng], 13);
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied."
            : "Couldn't get your location. Try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <button
        onClick={handleLocate}
        disabled={locating}
        className="absolute bottom-6 right-4 z-[1000] flex items-center gap-1.5 rounded-full border border-[#3a2f12] bg-black/90 px-3 py-2 text-xs font-medium text-[#e5c158] shadow-lg backdrop-blur hover:bg-black disabled:opacity-60"
      >
        <IconLocate className="h-3.5 w-3.5" />
        {locating ? "Locating…" : "Locate me"}
      </button>

      {locateError && (
        <div className="absolute bottom-20 right-4 z-[1000] max-w-[220px] rounded-md border border-red-900 bg-black/90 px-3 py-2 text-xs text-red-300 shadow-lg">
          {locateError}
        </div>
      )}
    </div>
  );
}

function fmt(value: number | undefined): string {
  return value == null ? "–" : value.toFixed(2);
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
