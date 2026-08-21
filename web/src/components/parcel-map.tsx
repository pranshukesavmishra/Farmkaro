"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  IS_DEV_BASEMAP,
  LABELS_TILE_URL,
  ROADS_TILE_URL,
  SATELLITE_TILE_URL,
  formatINR,
  type Position,
} from "@/lib/geo";
import type { ParcelView } from "@/lib/types";
import { Layers, Loader2, LocateFixed } from "lucide-react";

/**
 * Parcel map — real satellite imagery with clean price markers.
 *
 * Land is shown as recognisable property-style markers (a rent-labelled pill
 * over a pin) at each parcel's real location — not invented polygons. Only the
 * search radius is drawn as a shape, because that is a real, meaningful circle.
 * Markers are plain HTML so they stay crisp and easy to style.
 */

const SRC_RADIUS = "radius";
const SRC_SELECTED = "selected-parcel";

const compactRent = (n: number) => formatINR(n, { compact: true });

/** Circle approximation for the search radius, in true metres. */
function radiusPolygon(center: Position, km: number, steps = 96): GeoJSON.Feature {
  const coords: Position[] = [];
  const latR = km / 110.574;
  const lngR = km / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([center[0] + lngR * Math.cos(t), center[1] + latR * Math.sin(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

interface Props {
  parcels: ParcelView[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  center?: Position;
  radiusKm?: number;
  className?: string;
}

export function ParcelMap({ parcels, selectedId, onSelect, center, radiusKm, className }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(null!);
  if (!markers.current) markers.current = new Map();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = new maplibregl.Map({
      container: holder.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [SATELLITE_TILE_URL],
            tileSize: 256,
            maxzoom: 18,
            attribution: "Satellite imagery © Esri, Maxar, Earthstar Geographics",
          },
          // Hybrid overlays: place labels + roads on top of imagery, the same
          // composition Google's hybrid view uses. Skipped on the offline dev
          // basemap, which has no external network.
          ...(IS_DEV_BASEMAP
            ? {}
            : {
                places: { type: "raster" as const, tiles: [LABELS_TILE_URL], tileSize: 256, maxzoom: 18 },
                roads: { type: "raster" as const, tiles: [ROADS_TILE_URL], tileSize: 256, maxzoom: 18 },
              }),
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#0d1a12" } },
          { id: "satellite", type: "raster", source: "satellite" },
          ...(IS_DEV_BASEMAP
            ? []
            : [
                { id: "roads", type: "raster" as const, source: "roads", paint: { "raster-opacity": 0.85 } },
                { id: "places", type: "raster" as const, source: "places", paint: { "raster-opacity": 0.95 } },
              ]),
        ],
      },
      center: center ?? [79.9864, 23.1815],
      zoom: 10,
      maxZoom: 18,
      minZoom: 6,
    });
    map.current = m;

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    m.on("load", () => {
      m.addSource(SRC_RADIUS, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "radius-fill",
        type: "fill",
        source: SRC_RADIUS,
        paint: { "fill-color": "#5FA37F", "fill-opacity": 0.06 },
      });
      m.addLayer({
        id: "radius-line",
        type: "line",
        source: SRC_RADIUS,
        paint: { "line-color": "#5FA37F", "line-width": 1.2, "line-dasharray": [3, 3], "line-opacity": 0.8 },
      });

      // Selected parcel's real boundary — drawn on top of the satellite when a
      // farm is chosen, so pins (discovery) and polygon (detail) work together.
      m.addSource(SRC_SELECTED, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "sel-fill",
        type: "fill",
        source: SRC_SELECTED,
        paint: { "fill-color": "#C9A24B", "fill-opacity": 0.18 },
      });
      m.addLayer({
        id: "sel-line-shadow",
        type: "line",
        source: SRC_SELECTED,
        paint: { "line-color": "rgba(0,20,12,.55)", "line-width": 3.5 },
      });
      m.addLayer({
        id: "sel-line",
        type: "line",
        source: SRC_SELECTED,
        paint: { "line-color": "#F2D89A", "line-width": 2, "line-dasharray": [4, 3] },
      });

      // Click on empty map deselects.
      m.on("click", () => onSelect?.(null));
      setReady(true);
    });

    return () => {
      markers.current.forEach((mk) => mk.remove());
      markers.current.clear();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers: one price pill per parcel, reconciled on each data change.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const wanted = new Set(parcels.map((p) => p.id));
    // Remove stale markers.
    for (const [id, mk] of markers.current) {
      if (!wanted.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    }

    for (const p of parcels) {
      let mk = markers.current.get(p.id);
      if (!mk) {
        const el = document.createElement("button");
        el.type = "button";
        el.dataset.id = p.id;
        el.setAttribute("aria-label", `${p.village}, ${formatINR(p.listing.rentAnnual)} per year`);
        el.className = "fk-marker";
        el.innerHTML = `<span class="fk-marker-pill">${compactRent(p.listing.rentAnnual)}</span><span class="fk-marker-tip"></span>`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(p.id);
        });
        el.addEventListener("mouseenter", () => el.classList.add("is-hover"));
        el.addEventListener("mouseleave", () => el.classList.remove("is-hover"));
        mk = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(p.centroid).addTo(m);
        markers.current.set(p.id, mk);
      } else {
        mk.setLngLat(p.centroid);
      }
    }

    // Fit to the markers.
    if (parcels.length) {
      const b = new maplibregl.LngLatBounds();
      for (const p of parcels) b.extend(p.centroid as [number, number]);
      m.fitBounds(b, { padding: 70, maxZoom: 13.5, duration: 650 });
    }
  }, [parcels, ready, onSelect]);

  // Radius ring.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource(SRC_RADIUS) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      center && radiusKm
        ? { type: "FeatureCollection", features: [radiusPolygon(center, radiusKm)] }
        : { type: "FeatureCollection", features: [] },
    );
  }, [center, radiusKm, ready]);

  // Selection styling + boundary + recentre.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const [id, mk] of markers.current) {
      mk.getElement().classList.toggle("is-selected", id === selectedId);
    }
    const sel = m.getSource(SRC_SELECTED) as maplibregl.GeoJSONSource | undefined;
    const target = selectedId ? parcels.find((p) => p.id === selectedId) : null;
    if (sel) {
      sel.setData(
        target
          ? {
              type: "FeatureCollection",
              features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: target.geometry } }],
            }
          : { type: "FeatureCollection", features: [] },
      );
    }
    if (target) m.easeTo({ center: target.centroid, zoom: Math.max(m.getZoom(), 14), duration: 600 });
  }, [selectedId, ready, parcels]);

  return (
    <div className={className}>
      <style>{MARKER_CSS}</style>
      <div ref={holder} className="h-full w-full" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-forest-950/70">
          <span className="flex items-center gap-2 text-[13px] text-forest-100">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
          </span>
        </div>
      )}
      {ready && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white">
            <Layers className="h-3 w-3" aria-hidden />
            {parcels.length} farm{parcels.length === 1 ? "" : "s"} in view
          </span>
          {radiusKm && center && (
            <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white">
              <LocateFixed className="h-3 w-3" aria-hidden />
              {radiusKm} km radius
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const MARKER_CSS = `
.fk-marker { position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; background: none; border: 0; padding: 0; transform-origin: bottom center; transition: transform .15s ease; }
.fk-marker.is-hover { transform: scale(1.06); z-index: 5; }
.fk-marker.is-selected { z-index: 6; }
.fk-marker-pill {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px; font-weight: 600; line-height: 1;
  color: #fff; background: #003622; border: 1.5px solid rgba(255,255,255,.9);
  padding: 5px 9px; border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0,0,0,.45);
  white-space: nowrap;
}
.fk-marker.is-selected .fk-marker-pill { background: #C9A24B; color: #1a1405; border-color: #fff; }
.fk-marker.is-hover .fk-marker-pill { background: #0B4A32; }
.fk-marker-tip { width: 2px; height: 8px; background: rgba(255,255,255,.85); box-shadow: 0 1px 3px rgba(0,0,0,.5); }
.fk-marker.is-selected .fk-marker-tip { background: #C9A24B; }
`;

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-5 items-center rounded-full bg-forest-900 px-2 font-mono text-[10px] font-semibold text-white">
          ₹48k
        </span>
        Annual rent · tap to open
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-5 items-center rounded-full bg-gold px-2 font-mono text-[10px] font-semibold text-[#1a1405]">
          ₹48k
        </span>
        Selected
      </span>
    </div>
  );
}
