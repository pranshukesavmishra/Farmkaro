/**
 * The selection light — one soft, blurred streak that orbits a boundary at
 * constant on-screen speed, brightening from tail to head. It replaces every
 * marching-dash and scan-beam animation: a selected boundary is a clean solid
 * line with exactly one moving element, so the imagery underneath stays
 * readable and the motion reads calm instead of busy.
 *
 * The orbit is computed in screen pixels each frame (project the ring, walk
 * its perimeter, interpolate in geographic space), so the light travels at a
 * uniform visual speed at any zoom and keeps its place through pans.
 * Callers must not start it under prefers-reduced-motion.
 */
import type maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Add the comet's source and its two layers: a wide gold glow beneath a
 *  bright white core. `lineMetrics` powers the tail-to-head gradient. */
export function addCometLayers(m: MlMap, srcId: string): void {
  m.addSource(srcId, { type: "geojson", lineMetrics: true, data: EMPTY });
  m.addLayer({
    id: `${srcId}-glow`,
    type: "line",
    source: srcId,
    layout: { "line-cap": "round" },
    paint: {
      "line-width": 8,
      "line-blur": 5,
      "line-gradient": [
        "interpolate",
        ["linear"],
        ["line-progress"],
        0,
        "rgba(242,216,154,0)",
        0.6,
        "rgba(242,216,154,0.45)",
        1,
        "rgba(255,244,214,0.85)",
      ],
    },
  });
  m.addLayer({
    id: `${srcId}-core`,
    type: "line",
    source: srcId,
    layout: { "line-cap": "round" },
    paint: {
      "line-width": 2.1,
      "line-blur": 0.4,
      "line-gradient": [
        "interpolate",
        ["linear"],
        ["line-progress"],
        0,
        "rgba(255,255,255,0)",
        0.55,
        "rgba(255,255,255,0.4)",
        1,
        "rgba(255,255,255,0.98)",
      ],
    },
  });
}

/**
 * Match the light to the land beneath it. Bright imagery (sun-baked fallow,
 * sand) washes out a pale gold streak, so there the comet turns deep forest;
 * over dark green fields it stays gold-white. The sample is a cheap 48×48
 * readback of the rendered canvas (requires preserveDrawingBuffer on the
 * map), averaged to one luminance number. Call it on map idle.
 */
export function adaptCometToImagery(m: MlMap, srcId: string): void {
  try {
    if (!m.style || !m.getLayer(`${srcId}-glow`)) return;
    const canvas = m.getCanvas();
    const off = document.createElement("canvas");
    off.width = 48;
    off.height = 48;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, 48, 48);
    const px = ctx.getImageData(0, 0, 48, 48).data;
    let lum = 0;
    for (let i = 0; i < px.length; i += 4) lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    lum /= px.length / 4;

    const bright = lum > 150;
    const glow = bright
      ? [0, "rgba(8,46,32,0)", 0.6, "rgba(8,46,32,0.5)", 1, "rgba(16,72,50,0.9)"]
      : [0, "rgba(242,216,154,0)", 0.6, "rgba(242,216,154,0.45)", 1, "rgba(255,244,214,0.85)"];
    const core = bright
      ? [0, "rgba(6,32,22,0)", 0.55, "rgba(6,32,22,0.45)", 1, "rgba(3,20,14,0.98)"]
      : [0, "rgba(255,255,255,0)", 0.55, "rgba(255,255,255,0.4)", 1, "rgba(255,255,255,0.98)"];
    m.setPaintProperty(`${srcId}-glow`, "line-gradient", [
      "interpolate",
      ["linear"],
      ["line-progress"],
      ...glow,
    ]);
    m.setPaintProperty(`${srcId}-core`, "line-gradient", [
      "interpolate",
      ["linear"],
      ["line-progress"],
      ...core,
    ]);
  } catch {
    /* canvas unreadable (no preserveDrawingBuffer) — keep the gold default */
  }
}

/**
 * Start the orbit. `getRing` returns the current boundary as an UNCLOSED ring
 * (or null to hide the light); `isPaused` hides it without losing its place.
 * Returns a stop() that also clears the source. Safe against the map being
 * torn down mid-frame.
 */
export function startCometOrbit(
  m: MlMap,
  srcId: string,
  getRing: () => number[][] | null,
  isPaused?: () => boolean,
): () => void {
  const SPEED = 175; // px/second along the perimeter — brisk, alive
  let raf = 0;
  let dist = 0;
  let last = performance.now();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      if (!m.style) return;
      const src = m.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const ring = getRing();
      if (!ring || ring.length < 3 || isPaused?.()) {
        src.setData(EMPTY);
        return;
      }

      const closed = [...ring, ring[0]];
      const px = closed.map((p) => m.project(p as [number, number]));
      const seg: number[] = [];
      let total = 0;
      for (let i = 1; i < px.length; i++) {
        const d = Math.hypot(px[i].x - px[i - 1].x, px[i].y - px[i - 1].y);
        seg.push(d);
        total += d;
      }
      if (total < 24) {
        src.setData(EMPTY);
        return;
      }

      dist = (dist + SPEED * dt) % total;
      const len = Math.min(170, Math.max(46, total * 0.16));

      /** Geographic point at perimeter distance d (d already within [0,total)). */
      const at = (d: number): number[] => {
        let acc = 0;
        for (let i = 0; i < seg.length; i++) {
          if (d <= acc + seg[i] || i === seg.length - 1) {
            const f = seg[i] ? (d - acc) / seg[i] : 0;
            return [
              closed[i][0] + (closed[i + 1][0] - closed[i][0]) * f,
              closed[i][1] + (closed[i + 1][1] - closed[i][1]) * f,
            ];
          }
          acc += seg[i];
        }
        return [closed[0][0], closed[0][1]];
      };

      // Walk tail → head along the cyclic perimeter, emitting one continuous
      // LineString. Vertices past the ring's start simply repeat their
      // coordinates, so the line-progress gradient stays whole across the wrap.
      const tail = (dist - len + total * 2) % total;
      const coords: number[][] = [at(tail)];
      let i = 0;
      let cum = 0; // cumulative distance at the start of segment i
      while (i < seg.length && cum + seg[i] <= tail + 1e-9) {
        cum += seg[i];
        i++;
      }
      let p = tail;
      let remaining = len;
      let guard = 0;
      while (remaining > 0 && guard++ < closed.length * 2) {
        const toNextVertex = cum + (seg[i] ?? 0) - p;
        if (toNextVertex >= remaining) {
          coords.push(at((p + remaining) % total));
          remaining = 0;
        } else {
          coords.push([closed[i + 1][0], closed[i + 1][1]]);
          remaining -= toNextVertex;
          cum += seg[i];
          p = cum;
          i++;
          if (i >= seg.length) {
            i = 0;
            cum = 0;
            p = 0;
          }
        }
      }

      src.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      } as GeoJSON.Feature);
    } catch {
      /* map torn down mid-frame — the next stop() cleans up */
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    try {
      if (m.style) (m.getSource(srcId) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY);
    } catch {
      /* already gone */
    }
  };
}
