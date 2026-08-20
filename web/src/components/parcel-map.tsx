"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SATELLITE_TILE_URL, type Position } from "@/lib/geo";
import type { ParcelView } from "@/lib/types";
import { Layers, Loader2, LocateFixed, Maximize2 } from "lucide-react";

/**
 * Parcel map.
 *
 * Farmland is drawn as real polygons, never as pins — the boundary is the
 * information. Only features for the current viewport are rendered, and the
 * layer is styled so the imagery stays the dominant element on screen.
 */

const SRC = "parcels";
const SRC_RADIUS = "radius";

function toFeatureCollection(parcels: ParcelView[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels.map((p) => ({
      type: "Feature",
      id: Number(p.id.replace(/\D/g, "")) || 0,
      properties: {
        id: p.id,
        ref: p.ref,
        village: p.village,
        acres: +p.areaAcres.toFixed(2),
        rent: p.listing.rentAnnual,
        walked:
          p.geometryStatus === "boundary_walked_by_farmkaro" ||
          p.geometryStatus === "matched_to_cadastral_record",
      },
      geometry: { type: "Polygon", coordinates: p.geometry },
    })),
  };
}

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
  const hovered = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = new maplibregl.Map({
      container: holder.current,
      attributionControl: false,
      style: {
        version: 8,
        glyphs: undefined,
        sources: {
          satellite: {
            type: "raster",
            tiles: [SATELLITE_TILE_URL],
            tileSize: 256,
            maxzoom: 18,
            attribution: "Satellite imagery © Esri, Maxar, Earthstar Geographics",
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#001A10" } },
          { id: "satellite", type: "raster", source: "satellite" },
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
        paint: {
          "line-color": "#5FA37F",
          "line-width": 1.2,
          "line-dasharray": [3, 3],
          "line-opacity": 0.75,
        },
      });

      m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      m.addLayer({
        id: "parcel-fill",
        type: "fill",
        source: SRC,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#C9A24B",
            ["boolean", ["feature-state", "hover"], false], "#8FCBA9",
            ["get", "walked"], "#1B6B47",
            "#5FA37F",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.34,
            ["boolean", ["feature-state", "hover"], false], 0.26,
            0.14,
          ],
        },
      });

      // Shadow pass keeps the hairline legible over bright fields.
      m.addLayer({
        id: "parcel-line-shadow",
        type: "line",
        source: SRC,
        paint: { "line-color": "rgba(0,20,12,0.5)", "line-width": 3.2 },
      });

      m.addLayer({
        id: "parcel-line",
        type: "line",
        source: SRC,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#F2D89A",
            "rgba(255,255,255,0.92)",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 2.4,
            ["boolean", ["feature-state", "hover"], false], 2,
            1.5,
          ],
          "line-dasharray": [5, 4],
        },
      });

      m.on("mousemove", "parcel-fill", (e) => {
        m.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f || f.id === hovered.current) return;
        if (hovered.current != null) {
          m.setFeatureState({ source: SRC, id: hovered.current }, { hover: false });
        }
        hovered.current = f.id as number;
        m.setFeatureState({ source: SRC, id: hovered.current }, { hover: true });
      });

      m.on("mouseleave", "parcel-fill", () => {
        m.getCanvas().style.cursor = "";
        if (hovered.current != null) {
          m.setFeatureState({ source: SRC, id: hovered.current }, { hover: false });
        }
        hovered.current = null;
      });

      m.on("click", "parcel-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelect?.(String(id));
      });

      m.on("click", (e) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["parcel-fill"] });
        if (!hits.length) onSelect?.(null);
      });

      setReady(true);
    });

    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data updates
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc = toFeatureCollection(parcels);
    src.setData(fc);

    if (fc.features.length) {
      const b = new maplibregl.LngLatBounds();
      for (const f of fc.features) {
        for (const ring of (f.geometry as GeoJSON.Polygon).coordinates) {
          for (const c of ring) b.extend(c as [number, number]);
        }
      }
      m.fitBounds(b, { padding: 64, maxZoom: 14, duration: 650 });
    }
  }, [parcels, ready]);

  // Radius ring
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

  // Selection
  const prevSelected = useRef<number | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (prevSelected.current != null) {
      m.setFeatureState({ source: SRC, id: prevSelected.current }, { selected: false });
      prevSelected.current = null;
    }
    if (!selectedId) return;
    const numeric = Number(selectedId.replace(/\D/g, "")) || 0;
    m.setFeatureState({ source: SRC, id: numeric }, { selected: true });
    prevSelected.current = numeric;

    const target = parcels.find((p) => p.id === selectedId);
    if (target) m.easeTo({ center: target.centroid, zoom: Math.max(m.getZoom(), 13.4), duration: 600 });
  }, [selectedId, ready, parcels]);

  return (
    <div className={className}>
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
            {parcels.length} parcel{parcels.length === 1 ? "" : "s"} in view
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

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-[2px] border border-dashed border-white/80 bg-forest-500/30" />
        Boundary walked by FarmKaro
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-[2px] border border-dashed border-white/60 bg-forest-300/25" />
        Owner-supplied boundary
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-[2px] border border-dashed border-gold bg-gold/30" />
        Selected
      </span>
    </div>
  );
}

export { Maximize2 };
