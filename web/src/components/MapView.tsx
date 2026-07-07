"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import type {
  CommunityReport,
  ConfirmedSite,
  LayerVisibility,
  RiskCell,
} from "@/lib/types";

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
  if (score >= 0.8) return "#dc2626"; // red-600
  if (score >= 0.65) return "#ea580c"; // orange-600
  if (score >= 0.5) return "#f59e0b"; // amber-500
  return "#eab308"; // yellow-500
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
  } | null>(null);

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
          color: confirmed ? "#dc2626" : "#f59e0b",
          fillColor: confirmed ? "#ef4444" : "#fbbf24",
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
        L.circleMarker([site.lat, site.lng], {
          radius: selected ? 12 : 9,
          color: "#7f1d1d",
          fillColor: "#dc2626",
          fillOpacity: 0.95,
          weight: selected ? 3 : 2,
        })
          .bindTooltip(site.name)
          .on("click", () => onSelectSite(site))
          .addTo(groups.sites);
      }
    }
  }, [sites, reports, riskCells, layers, selectedSiteId, onSelectSite]);

  return <div ref={containerRef} className="h-full w-full" />;
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
