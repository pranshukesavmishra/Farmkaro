"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { m2ToAcres, polygonAreaM2, SATELLITE_TILE_URL, type Position, type Ring } from "@/lib/geo";
import { suggestBoundary } from "@/lib/boundary-suggest";
import { addCometLayers, startCometOrbit } from "@/lib/comet";
import { useLang } from "@/lib/i18n";
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
const COMET_SRC = "draw-comet";

/** FarmSelect AI reads at this detail: the outline hugs every bend of the
 *  field, capped so every dot stays a draggable handle. */
const FINE_DETAIL = { epsilon: 1.15, maxCorners: 64 } as const;

/** Below this zoom one screen pixel is bigger than a bund — the imagery can't
 *  resolve a single field, so FarmSelect AI asks for a closer view instead of
 *  guessing. */
const MIN_AI_ZOOM = 12.5;

/**
 * The reveal: a solid gold line sweeps the perimeter at uniform speed behind a
 * glowing pen tip, then settles into the clean solid line. On-screen pixel
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
      // The traced ring commits as a closed boundary immediately after: solid.
      m.setPaintProperty("draw-line", "line-dasharray", [1, 0]);
    }
  }
}

export function BoundaryDrawMap({ center, zoom = 15, value, onChange, className }: Props) {
  const { t } = useLang();
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
  // The map starts inert so scrolling the page never hijacks into the map.
  // The first tap engages it (and only engages — it places no dot); a click
  // outside or Escape puts it back to rest.
  const [engaged, setEngaged] = useState(false);
  const engagedRef = useRef(false);
  engagedRef.current = engaged;

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
          {
            id: "satellite",
            type: "raster",
            source: "satellite",
            // A gentle grade — slightly richer greens and deeper contrast —
            // so the imagery reads premium rather than washed out.
            paint: {
              "raster-saturation": 0.15,
              "raster-contrast": 0.08,
              "raster-fade-duration": 200,
            },
          },
        ],
      },
      center,
      zoom,
      // Tiles stop at z18; past that MapLibre upscales them smoothly, which
      // still helps when tracing a small field's corners.
      maxZoom: 19.4,
      doubleClickZoom: false,
      // The AI assist reads the rendered imagery back out of the canvas.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.current = m;
    // Fullscreen wraps the whole widget (holder's parent), so the toolbar,
    // area chip and notes ride along. The control's own button flips to an
    // exit icon while fullscreen, and Escape exits natively.
    m.addControl(
      new maplibregl.FullscreenControl({ container: holder.current.parentElement ?? undefined }),
      "bottom-right",
    );
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    // No on-map attribution pill: every page that shows imagery renders the
    // Esri credit line right under the map instead (SatelliteAttribution).

    // Inert until engaged: no handler may steal the page scroll or a stray
    // drag. The first click flips them all on.
    m.scrollZoom.disable();
    m.dragPan.disable();
    m.keyboard.disable();
    m.touchZoomRotate.disable();
    m.dragRotate.disable();

    m.on("load", () => {
      m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "draw-fill",
        type: "fill",
        source: SRC,
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#5FA37F", "fill-opacity": 0.18 },
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
          // Dashed while the path is open (work in progress); the render
          // effect flips it to a clean solid line once the boundary closes.
          "line-dasharray": [5, 4],
        },
      });
      // The one moving element on a closed boundary: the orbiting light.
      addCometLayers(m, COMET_SRC);
      setReady(true);
    });

    m.on("click", (e) => {
      // First tap wakes the map up — and is consumed by that, except for an
      // AI seed tap, which would be wasteful to throw away.
      if (!engagedRef.current) {
        engagedRef.current = true;
        setEngaged(true);
        m.scrollZoom.enable();
        m.dragPan.enable();
        m.keyboard.enable();
        m.touchZoomRotate.enable();
        if (aiRef.current !== "await-tap") return;
      }
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

  // Rest the map again when attention moves elsewhere: a click outside the
  // widget, or Escape. (Escape inside fullscreen exits fullscreen instead —
  // the browser fires that before this handler sees a fullscreenElement.)
  useEffect(() => {
    if (!engaged) return;
    const disengage = () => {
      const m = map.current;
      if (m && m.style) {
        m.scrollZoom.disable();
        m.dragPan.disable();
        m.keyboard.disable();
        m.touchZoomRotate.disable();
      }
      setEngaged(false);
    };
    const onDown = (e: PointerEvent) => {
      const root = holder.current?.parentElement;
      if (root && e.target instanceof Node && !root.contains(e.target)) disengage();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) disengage();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [engaged]);

  // Once the boundary closes, exactly one thing moves: a soft light orbiting
  // the solid line — the Apple-style selection. Hidden while the AI trace
  // owns the line; never started under reduced motion.
  const closed = points.length >= 3;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !closed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return startCometOrbit(
      m,
      COMET_SRC,
      () => (pointsRef.current.length >= 3 ? pointsRef.current : null),
      () => aiRef.current === "busy",
    );
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

    // In-progress path is dashed; a closed boundary is a clean solid line
    // (the orbiting light is its only motion).
    if (m.getLayer("draw-line")) {
      m.setPaintProperty("draw-line", "line-dasharray", points.length >= 3 ? [1, 0] : [5, 4]);
    }

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
            {t(aiNote)}
          </p>
        </div>
      )}

      {!engaged && !aiNote && (
        <div className="pointer-events-none absolute inset-x-3 bottom-12 z-10 flex justify-center">
          <p className="glass animate-fade-up rounded-full px-3.5 py-1.5 text-center text-[12px] text-white/85">
            {t("Tap the map once to start moving and marking")}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="glass pointer-events-auto rounded-xl px-3 py-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-white/65">
            {points.length < 3 ? t("Tap the corners of your field") : t("Estimated area")}
          </p>
          <p className="font-mono text-[17px] font-semibold tabular-nums text-white">
            {points.length < 3
              ? `${points.length} ${t(points.length === 1 ? "point placed" : "points placed")}`
              : `${areaAcres.toFixed(2)} ${t("acres")}`}
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
            <span translate="no" className="notranslate">
              FarmSelect AI
            </span>
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!points.length}
            aria-label={t("Undo last point")}
            title={t("Undo last point")}
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white transition-transform hover:enabled:-translate-y-px disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!redoStack.length}
            aria-label={t("Redo")}
            title={t("Redo")}
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white transition-transform hover:enabled:-translate-y-px disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!points.length}
            aria-label={t("Clear boundary")}
            title={t("Clear boundary")}
            className="glass focus-ring grid h-9 w-9 place-items-center rounded-lg text-white transition-transform hover:enabled:-translate-y-px disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
