"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { m2ToAcres, polygonAreaM2, SATELLITE_TILE_URL, type Position, type Ring } from "@/lib/geo";
import { suggestBoundary } from "@/lib/boundary-suggest";
import { Loader2, Redo2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Boundary drawing tool.
 *
 * Click to drop vertices on satellite imagery, drag to adjust, undo/redo,
 * close the polygon. Acreage is computed live with the same spherical maths
 * the backend uses, so the number the owner sees while drawing is the number
 * the parcel record will store. The result is honest owner-drawn geometry —
 * it is labelled that way and enters the verification ladder at
 * "boundary_drawn", never higher.
 */

interface Props {
  center: Position;
  zoom?: number;
  value?: Ring;
  onChange: (ring: Ring, areaAcres: number) => void;
  className?: string;
}

const SRC = "draw";

export function BoundaryDrawMap({ center, zoom = 15, value, onChange, className }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>(null!);
  if (!markers.current) markers.current = [];

  const [points, setPoints] = useState<Position[]>(value ?? []);
  const [redoStack, setRedoStack] = useState<Position[][]>([]);
  const [ready, setReady] = useState(false);
  // AI assist: idle -> awaiting a tap (when no points exist yet) -> busy
  // while it reads the imagery and animates the corners in.
  const [ai, setAi] = useState<"idle" | "await-tap" | "busy">("idle");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const aiRef = useRef<"idle" | "await-tap" | "busy">("idle");
  aiRef.current = ai;
  const pointsRef = useRef<Position[]>(points);
  pointsRef.current = points;

  const areaAcres = points.length >= 3 ? m2ToAcres(polygonAreaM2([[...points, points[0]]])) : 0;

  const emit = useCallback(
    (pts: Position[]) => {
      if (pts.length >= 3) onChange([...pts, pts[0]], m2ToAcres(polygonAreaM2([[...pts, pts[0]]])));
      else onChange([], 0);
    },
    [onChange],
  );

  /**
   * The AI assist. Reads the imagery currently on screen, grows the field
   * around the seed, and animates the suggested corners in one by one.
   * Every result stays an owner-drawn SUGGESTION: draggable, correctable,
   * and it enters the ladder no higher than any hand-drawn boundary.
   */
  const runSuggestRef = useRef(async (_cx: number, _cy: number) => {});
  runSuggestRef.current = async (cx: number, cy: number) => {
    const m = map.current;
    if (!m) return;
    setAi("busy");
    setAiNote(null);
    try {
      const mapCanvas = m.getCanvas();
      const cssW = mapCanvas.clientWidth;
      const cssH = mapCanvas.clientHeight;
      // Downsample for speed; the corner budget makes precision moot anyway.
      const target = 360;
      const scale = Math.min(1, target / Math.max(cssW, cssH));
      const w = Math.max(1, Math.round(cssW * scale));
      const h = Math.max(1, Math.round(cssH * scale));
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(mapCanvas, 0, 0, w, h);
      const rgba = ctx.getImageData(0, 0, w, h).data;

      const seed = { x: Math.round(cx * scale), y: Math.round(cy * scale) };
      const poly = suggestBoundary(rgba, w, h, seed);
      if (!poly) {
        setAi("idle");
        setAiNote(
          "Couldn't read a clear field there — tap nearer the middle of your field, or keep drawing by hand.",
        );
        return;
      }

      // Pixel path -> geographic corners.
      const ring: Position[] = poly.map((p) => {
        const ll = m.unproject([p.x / scale, p.y / scale]);
        return [ll.lng, ll.lat];
      });

      // Animate the corners dropping in, dot by dot, like a careful hand.
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setRedoStack(pointsRef.current.length ? [pointsRef.current] : []);
      if (reduced) {
        setPoints(ring);
      } else {
        setPoints([]);
        for (let i = 0; i < ring.length; i++) {
          await new Promise((r) => setTimeout(r, i === 0 ? 120 : 90));
          setPoints(ring.slice(0, i + 1));
        }
      }
      setAi("idle");
      setAiNote(
        "AI suggestion read from the imagery — drag any corner to correct it. It stays owner-drawn until FarmKaro walks the boundary.",
      );
    } catch {
      setAi("idle");
      setAiNote("Could not read the imagery here. Please draw the corners by hand.");
    }
  };

  /** Entry point from the toolbar button. */
  function startSuggest() {
    if (ai === "busy") return;
    setAiNote(null);
    const m = map.current;
    const pts = pointsRef.current;
    if (m && pts.length >= 1) {
      // The person has begun marking — seed from the middle of their dots.
      const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const px = m.project([lng, lat]);
      void runSuggestRef.current(px.x, px.y);
    } else {
      setAi("await-tap");
      setAiNote("Tap once inside your field and the AI will mark it for you.");
    }
  }

  // --- map bootstrap ---------------------------------------------------------
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
            attribution: "Satellite imagery © Esri",
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#001A10" } },
          { id: "satellite", type: "raster", source: "satellite" },
        ],
      },
      center,
      zoom,
      maxZoom: 18,
      doubleClickZoom: false,
      // The AI assist reads the rendered imagery back out of the canvas.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    m.on("load", () => {
      m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "draw-fill",
        type: "fill",
        source: SRC,
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#5FA37F", "fill-opacity": 0.18 },
      });
      m.addLayer({
        id: "draw-line-shadow",
        type: "line",
        source: SRC,
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "rgba(0,20,12,.5)", "line-width": 3.4 },
      });
      m.addLayer({
        id: "draw-line",
        type: "line",
        source: SRC,
        filter: ["==", "$type", "LineString"],
        paint: {
          "line-color": "rgba(255,255,255,.95)",
          "line-width": 1.8,
          "line-dasharray": [5, 4],
        },
      });
      setReady(true);
    });

    m.on("click", (e) => {
      if (aiRef.current === "await-tap") {
        void runSuggestRef.current(e.point.x, e.point.y);
        return;
      }
      if (aiRef.current === "busy") return;
      setRedoStack([]);
      setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    });

    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-centre when the chosen village changes.
  useEffect(() => {
    map.current?.easeTo({ center, zoom, duration: 700 });
  }, [center, zoom]);

  // --- render points ---------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const features: GeoJSON.Feature[] = [];
    if (points.length >= 2) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [...points, ...(points.length >= 3 ? [points[0]] : [])] },
      });
    }
    if (points.length >= 3) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
      });
    }
    src.setData({ type: "FeatureCollection", features });

    // Vertex handles as draggable markers.
    markers.current.forEach((mk) => mk.remove());
    markers.current = points.map((pt, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fk-vertex";
      el.setAttribute("aria-label", `Vertex ${i + 1} — drag to adjust`);
      const mk = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(pt).addTo(m);
      mk.on("dragend", () => {
        const ll = mk.getLngLat();
        setPoints((prev) => prev.map((p, j) => (j === i ? [ll.lng, ll.lat] : p)));
      });
      return mk;
    });

    emit(points);
  }, [points, ready, emit]);

  const undo = () => {
    setPoints((prev) => {
      if (!prev.length) return prev;
      setRedoStack((r) => [...r, prev]);
      return prev.slice(0, -1);
    });
  };
  const redo = () => {
    setRedoStack((r) => {
      if (!r.length) return r;
      setPoints(r[r.length - 1]);
      return r.slice(0, -1);
    });
  };
  const clear = () => {
    setRedoStack((r) => (points.length ? [...r, points] : r));
    setPoints([]);
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={holder} className="h-full w-full rounded-xl" />

      {aiNote && (
        <div className="pointer-events-none absolute inset-x-3 bottom-12 z-10 flex justify-center">
          <p
            className="glass max-w-[34rem] rounded-xl px-3.5 py-2 text-center text-[12px] leading-relaxed text-white/90"
            aria-live="polite"
          >
            {aiNote}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="glass pointer-events-auto rounded-xl px-3 py-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-white/65">
            {points.length < 3 ? "Tap the corners of your field" : "Estimated area"}
          </p>
          <p className="font-mono text-[17px] font-semibold tabular-nums text-white">
            {points.length < 3
              ? `${points.length} point${points.length === 1 ? "" : "s"} placed`
              : `${areaAcres.toFixed(2)} acres`}
          </p>
        </div>

        <div className="pointer-events-auto flex gap-1.5">
          <button
            type="button"
            onClick={startSuggest}
            disabled={ai === "busy"}
            aria-label="AI: mark my land from the imagery"
            title="AI: mark my land — reads the field you are marking and places the corners for you"
            className={cn(
              "glass focus-ring flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition-transform",
              ai === "await-tap" && "ring-2 ring-[#E3BE76]",
              ai !== "busy" && "hover:-translate-y-px",
            )}
          >
            {ai === "busy" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 text-[#E3BE76]" aria-hidden />
            )}
            AI mark
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!points.length}
            aria-label="Undo last point"
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!redoStack.length}
            aria-label="Redo"
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!points.length}
            aria-label="Clear boundary"
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
