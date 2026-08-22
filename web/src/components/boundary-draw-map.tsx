"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { m2ToAcres, polygonAreaM2, SATELLITE_TILE_URL, type Position, type Ring } from "@/lib/geo";
import { suggestBoundary } from "@/lib/boundary-suggest";
import { sweepRange, sweepSegments } from "@/lib/sweep";
import { Loader2, MousePointerClick, Redo2, Trash2, Undo2 } from "lucide-react";
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
const SWEEP_SRC = "sweep";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** FarmSelect AI reads at this detail: the outline hugs every bend of the
 *  field, capped so every dot stays a draggable handle. */
const FINE_DETAIL = { epsilon: 1.15, maxCorners: 64 } as const;

/** Below this zoom one screen pixel is bigger than a bund — the imagery can't
 *  resolve a single field, so FarmSelect AI asks for a closer view instead of
 *  guessing. */
const MIN_AI_ZOOM = 12.5;

/** Phase-shifted renderings of the [5,4] dash — stepped on a timer they read
 *  as the dash circulating uniformly around the boundary (MapLibre cannot
 *  animate a dash offset directly). */
const DASH_PHASES: number[][] = [
  [5, 4],
  [4, 4, 1, 0],
  [3, 4, 2, 0],
  [2, 4, 3, 0],
  [1, 4, 4, 0],
  [0.05, 4, 4.95, 0],
  [0.05, 3, 5, 1],
  [0.05, 2, 5, 2],
  [0.05, 1, 5, 3],
];

/**
 * The reveal: a solid gold line sweeps the perimeter at uniform speed behind a
 * glowing pen tip, then settles into the standard white dash. On-screen pixel
 * distances drive the interpolation so the sweep neither rushes short segments
 * nor crawls long ones. Pure decoration — reduced-motion users get the
 * boundary instantly and never enter here.
 */
async function tracePerimeter(m: MlMap, ring: Position[]): Promise<void> {
  const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
  if (!src || ring.length < 3) return;
  const closed = [...ring, ring[0]];
  const px = closed.map((p) => m.project(p as [number, number]));
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < px.length; i++) {
    const d = Math.hypot(px[i].x - px[i - 1].x, px[i].y - px[i - 1].y);
    seg.push(d);
    total += d;
  }
  if (total < 4) return;
  const duration = Math.max(850, Math.min(1700, total * 1.1));

  const tip = document.createElement("div");
  tip.className = "fk-trace-tip";
  const tipMarker = new maplibregl.Marker({ element: tip })
    .setLngLat(closed[0] as [number, number])
    .addTo(m);

  try {
    m.setPaintProperty("draw-line", "line-color", "#F2D89A");
    m.setPaintProperty("draw-line", "line-width", 2.4);
    m.setPaintProperty("draw-line", "line-dasharray", [1, 0]);

    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        try {
          if (!m.style || !m.getLayer("draw-line")) return resolve(); // map torn down mid-trace
          const t = Math.min(1, (now - t0) / duration);
          const dist = t * total;
          const coords: Position[] = [closed[0]];
          let acc = 0;
          for (let i = 0; i < seg.length; i++) {
            if (acc + seg[i] <= dist) {
              acc += seg[i];
              coords.push(closed[i + 1]);
              continue;
            }
            const f = seg[i] ? (dist - acc) / seg[i] : 0;
            coords.push([
              closed[i][0] + (closed[i + 1][0] - closed[i][0]) * f,
              closed[i][1] + (closed[i + 1][1] - closed[i][1]) * f,
            ]);
            break;
          }
          if (coords.length >= 2) {
            src.setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: { type: "LineString", coordinates: coords },
                },
              ],
            });
            tipMarker.setLngLat(coords[coords.length - 1] as [number, number]);
          }
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        } catch {
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  } finally {
    tipMarker.remove();
    if (m.style && m.getLayer("draw-line")) {
      m.setPaintProperty("draw-line", "line-color", "rgba(255,255,255,.95)");
      m.setPaintProperty("draw-line", "line-width", 1.8);
      m.setPaintProperty("draw-line", "line-dasharray", [5, 4]);
    }
  }
}

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
  // Set just before FarmSelect AI commits its ring: the next marker render
  // staggers the dot pops around the boundary instead of all at once.
  const staggerRef = useRef(false);

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
    if (m.getZoom() < MIN_AI_ZOOM) {
      setAi("idle");
      setAiNote(
        "Zoom in until your field fills the view — FarmSelect AI reads the imagery on screen, and from this height one field is only a few pixels.",
      );
      return;
    }
    setAi("busy");
    setAiNote(null);
    try {
      const mapCanvas = m.getCanvas();
      const cssW = mapCanvas.clientWidth;
      const cssH = mapCanvas.clientHeight;
      // Downsample for speed — but keep enough resolution that the outline
      // can follow every small bend of the bund, not just the broad shape.
      const target = 520;
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
      const poly = suggestBoundary(rgba, w, h, seed, FINE_DETAIL);
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

      // The reveal: a gold pen sweeps the perimeter at uniform speed, then
      // the dots pop in one after another around the ring.
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setRedoStack(pointsRef.current.length ? [pointsRef.current] : []);
      if (reduced) {
        setPoints(ring);
      } else {
        setPoints([]);
        await tracePerimeter(m, ring);
        staggerRef.current = true;
        setPoints(ring);
      }
      setAi("idle");
      setAiNote(
        "FarmSelect AI traced your field from the imagery — drag any dot to fine-tune it. It stays owner-drawn until FarmKaro walks the boundary.",
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
    if (m && m.getZoom() < MIN_AI_ZOOM) {
      setAiNote(
        "Zoom in until your field fills the view — FarmSelect AI reads the imagery on screen, and from this height one field is only a few pixels.",
      );
      return;
    }
    const pts = pointsRef.current;
    if (m && pts.length >= 1) {
      // The person has begun marking — seed from the middle of their dots.
      const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const px = m.project([lng, lat]);
      void runSuggestRef.current(px.x, px.y);
    } else {
      setAi("await-tap");
      setAiNote("Tap once inside your field and FarmSelect AI will mark it for you, point by point.");
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
      // The scan beam that glides across a closed boundary. Sits over the
      // fill but beneath the boundary line itself.
      m.addSource(SWEEP_SRC, { type: "geojson", data: EMPTY_FC });
      m.addLayer({
        id: "sweep-line",
        type: "line",
        source: SWEEP_SRC,
        paint: { "line-color": "#F7EFD8", "line-width": 1.6, "line-opacity": 0.55, "line-blur": 1.4 },
      });
      // Soft gold halo beneath the line — it also lights the AI trace.
      m.addLayer({
        id: "draw-glow",
        type: "line",
        source: SRC,
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "#F2D89A", "line-width": 8, "line-opacity": 0.16, "line-blur": 5 },
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

  // Once the boundary closes, its dash circulates uniformly — the marked land
  // reads as selected, Apple-crop style. Paused while the AI trace owns the
  // line, stilled entirely under reduced motion.
  const closed = points.length >= 3;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !closed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The map may already be torn down when this cleanup runs — React runs
    // unmount cleanups in definition order, so the bootstrap effect's
    // m.remove() happens first. Never touch a dead map.
    const live = () => !!m.style && !!m.getLayer("draw-line");
    let i = 0;
    const t = setInterval(() => {
      if (!live() || aiRef.current === "busy") return;
      i = (i + 1) % DASH_PHASES.length;
      m.setPaintProperty("draw-line", "line-dasharray", DASH_PHASES[i]);
    }, 90);
    return () => {
      clearInterval(t);
      if (live()) m.setPaintProperty("draw-line", "line-dasharray", [5, 4]);
    };
  }, [ready, closed]);

  // The scan: one soft beam of light gliding diagonally across the selected
  // area, clipped to the boundary — recomputed per frame so it stays true
  // through pans and zooms. Decorative only; reduced-motion never starts it.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !closed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const live = () => !!m.style && !!m.getSource(SWEEP_SRC);
    const n = { x: Math.SQRT1_2, y: Math.SQRT1_2 }; // 45° travel
    const PERIOD = 3200;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!live() || aiRef.current === "busy") return;
      const pts = pointsRef.current;
      if (pts.length < 3) return;
      const ringPx = pts.map((p) => m.project(p as [number, number]));
      const { min, max } = sweepRange(ringPx, n);
      const phase = ((now - t0) % PERIOD) / PERIOD;
      const c = min + (max - min) * phase;
      const segs = sweepSegments(ringPx, n, c);
      (m.getSource(SWEEP_SRC) as maplibregl.GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiLineString",
          coordinates: segs.map(([a, b]) => {
            const la = m.unproject([a.x, a.y]);
            const lb = m.unproject([b.x, b.y]);
            return [
              [la.lng, la.lat],
              [lb.lng, lb.lat],
            ];
          }),
        },
      });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (live()) (m.getSource(SWEEP_SRC) as maplibregl.GeoJSONSource).setData(EMPTY_FC);
    };
  }, [ready, closed]);

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

    // Vertex handles as draggable markers. A fine AI outline has many points,
    // so its dots shrink to stay legible — every one still drags.
    const stagger = staggerRef.current;
    staggerRef.current = false;
    const fine = points.length > 18;
    markers.current.forEach((mk) => mk.remove());
    markers.current = points.map((pt, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = fine ? "fk-vertex fk-vertex--fine" : "fk-vertex";
      if (stagger) el.style.animationDelay = `${Math.min(i * 22, 950)}ms`;
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
            aria-label="FarmSelect AI: mark my land from the imagery"
            title="FarmSelect AI — reads the field you are marking and traces the boundary for you, point by point"
            className={cn(
              "glass focus-ring flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition-transform",
              ai === "await-tap" && "ring-2 ring-[#E3BE76]",
              ai !== "busy" && "hover:-translate-y-px",
            )}
          >
            {ai === "busy" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MousePointerClick className="h-4 w-4 text-[#E3BE76]" aria-hidden />
            )}
            FarmSelect AI
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!points.length}
            aria-label="Undo last point"
            title="Undo last point"
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white transition-transform hover:enabled:-translate-y-px disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!redoStack.length}
            aria-label="Redo"
            title="Redo"
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white transition-transform hover:enabled:-translate-y-px disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!points.length}
            aria-label="Clear boundary"
            title="Clear boundary"
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white transition-transform hover:enabled:-translate-y-px disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
