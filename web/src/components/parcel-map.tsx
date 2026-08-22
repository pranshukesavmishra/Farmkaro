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
        id: "sel-glow",
        type: "line",
        source: SRC_SELECTED,
        paint: { "line-color": "#F2D89A", "line-width": 9, "line-opacity": 0.22, "line-blur": 4 },
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

  // A stable signature for the parcel set. The parent rebuilds its filtered
  // array on every render, and keying the camera off that identity made the
  // map re-animate whenever anything else on the page changed.
  const parcelKey = parcels.map((p) => p.id).join(",");

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
        el.innerHTML =
          `<span class="fk-marker-pill">${compactRent(p.listing.rentAnnual)}</span>` +
          `<span class="fk-marker-dot"></span>` +
          `<span class="fk-marker-tip"></span>`;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelKey, ready, onSelect]);

  /**
   * Declutter. Price pills are HTML markers, so MapLibre's symbol collision
   * detection does not apply to them: at a district-wide zoom — and at any
   * zoom on a phone — neighbouring parcels stack their prices into an
   * unreadable pile. Each frame, walk the markers and collapse any whose label
   * would overlap one already placed. A collapsed marker becomes a dot rather
   * than disappearing: the parcel is still visible, still tappable, and zooming
   * in restores its price.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const PAD = 3; // a little breathing room, so pills never touch

    const declutter = () => {
      // Measure what is actually on screen rather than re-projecting the
      // coordinates: MapLibre composes a marker's position from its own
      // transform, so a second projection can disagree with the pixels the
      // reader sees. Two passes — expand everything, then measure — so the
      // rectangles are all full-size pills and comparable.
      const entries = [...markers.current.entries()];
      for (const [, mk] of entries) mk.getElement().classList.remove("is-collapsed");

      const boxes = entries
        .map(([id, mk]) => ({ id, el: mk.getElement(), r: mk.getElement().getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && x.r.height > 0)
        // The selected parcel keeps its price whatever else is on screen; the
        // rest resolve top-to-bottom, which stays stable as the map moves.
        .sort((a, b) => {
          if (a.id === selectedId) return -1;
          if (b.id === selectedId) return 1;
          return a.r.top - b.r.top;
        });

      const placed: DOMRect[] = [];
      for (const { id, el, r } of boxes) {
        const hit = placed.some(
          (q) =>
            r.left < q.right + PAD &&
            r.right + PAD > q.left &&
            r.top < q.bottom + PAD &&
            r.bottom + PAD > q.top,
        );
        if (hit && id !== selectedId) el.classList.add("is-collapsed");
        else placed.push(r);
      }
    };

    // "render" rather than "move": an eased camera (fitBounds, double-tap zoom)
    // finishes with frames that "move" does not cover, and deferring the pass
    // to the next animation frame leaves it a frame behind the pixels — enough
    // to let a hairline overlap through. The pass is a few dozen rect reads, so
    // it runs synchronously with the frame that draws them.
    // MapLibre commits marker transforms around the frame it emits "render"
    // on, so a pass that runs synchronously with that event can read the
    // previous frame's positions. Running during motion keeps labels roughly
    // right; a pass on the next animation frame after the camera settles is
    // what makes the final state exact.
    let settle = 0;
    const settleLater = () => {
      cancelAnimationFrame(settle);
      settle = requestAnimationFrame(() => requestAnimationFrame(declutter));
    };

    declutter();
    settleLater();
    m.on("render", declutter);
    m.on("moveend", settleLater);
    m.on("zoomend", settleLater);
    m.on("idle", settleLater);
    return () => {
      cancelAnimationFrame(settle);
      m.off("render", declutter);
      m.off("moveend", settleLater);
      m.off("zoomend", settleLater);
      m.off("idle", settleLater);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelKey, ready, selectedId]);

  /**
   * The selected boundary's dash marches — the surveyor's line come alive.
   * MapLibre cannot animate a dash offset directly, so the pattern itself is
   * stepped through phase-shifted variants on a timer. Decorative only:
   * reduced-motion leaves the dash still.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !selectedId) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Phase-shifted renderings of the same [4,3] dash.
    const PHASES: number[][] = [
      [4, 3],
      [3.2, 3, 0.8, 0],
      [2.4, 3, 1.6, 0],
      [1.6, 3, 2.4, 0],
      [0.8, 3, 3.2, 0],
      [0.05, 3, 3.95, 0],
      [0.05, 2.2, 4, 0.8],
      [0.05, 1.4, 4, 1.6],
      [0.05, 0.6, 4, 2.4],
    ];
    let i = 0;
    const t = setInterval(() => {
      if (!m.getLayer("sel-line")) return;
      i = (i + 1) % PHASES.length;
      m.setPaintProperty("sel-line", "line-dasharray", PHASES[i]);
    }, 90);
    return () => {
      clearInterval(t);
      if (m.getLayer("sel-line")) m.setPaintProperty("sel-line", "line-dasharray", [4, 3]);
    };
  }, [ready, selectedId]);

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

/* Collapsed: at a zoom where this pill would sit on top of another, it becomes
   a dot. The parcel stays visible and tappable — it is not hidden — and the
   prices that are shown stay readable.

   The pill keeps its space and only loses its paint. MapLibre positions a
   marker with a percentage translate, so an element that changes size also
   changes where it sits: collapsing with display:none moved the marker, and
   the next measurement then disagreed with the pixels on screen. Only the dot
   takes pointer events while collapsed, so the invisible pill cannot swallow a
   tap meant for its neighbour. */
.fk-marker-dot { display: none; position: absolute; left: 50%; top: 5px; transform: translateX(-50%); width: 11px; height: 11px; border-radius: 999px; background: #003622; border: 1.5px solid rgba(255,255,255,.9); box-shadow: 0 1px 5px rgba(0,0,0,.45); }
.fk-marker.is-collapsed { pointer-events: none; }
.fk-marker.is-collapsed .fk-marker-pill { visibility: hidden; }
.fk-marker.is-collapsed .fk-marker-dot { display: block; pointer-events: auto; cursor: pointer; }
.fk-marker.is-collapsed.is-selected .fk-marker-dot { background: #C9A24B; }
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
        <span className="inline-flex h-5 items-center rounded-full bg-ochre-400 px-2 font-mono text-[10px] font-semibold text-ochre-900">
          ₹48k
        </span>
        Selected
      </span>
    </div>
  );
}
