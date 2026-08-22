/**
 * The AI boundary pipeline on synthetic imagery: a homogeneous "field" on a
 * contrasting background must come back as a tight, simple polygon; noise,
 * specks and runaway regions must come back as an honest null.
 */
import { describe, expect, it } from "vitest";
import {
  growRegion,
  simplifyPath,
  smoothMask,
  suggestBoundary,
  traceContour,
  type Pt,
} from "@/lib/boundary-suggest";
import { ringSelfIntersects } from "@/lib/geo";

/** Every suggestion the pipeline hands out must be simple geometry. */
function expectSimple(poly: Pt[]) {
  expect(ringSelfIntersects(poly.map((p) => [p.x, p.y]))).toBe(false);
}

/** Paint a W×H image: background colour, then coloured rectangles on top. */
function image(
  w: number,
  h: number,
  bg: [number, number, number],
  rects: Array<{ x: number; y: number; w: number; h: number; c: [number, number, number] }>,
): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = bg[0];
    px[i * 4 + 1] = bg[1];
    px[i * 4 + 2] = bg[2];
    px[i * 4 + 3] = 255;
  }
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = (y * w + x) * 4;
        px[i] = r.c[0];
        px[i + 1] = r.c[1];
        px[i + 2] = r.c[2];
      }
    }
  }
  return px;
}

const GREEN: [number, number, number] = [70, 120, 60];
const SAND: [number, number, number] = [200, 185, 140];

describe("growRegion", () => {
  it("fills exactly the tapped field and not its neighbour", () => {
    const w = 100, h = 100;
    const px = image(w, h, SAND, [
      { x: 10, y: 10, w: 35, h: 30, c: GREEN },
      { x: 60, y: 55, w: 30, h: 35, c: [40, 80, 130] },
    ]);
    const mask = growRegion(px, w, h, { x: 25, y: 22 })!;
    expect(mask).not.toBeNull();
    let inField = 0, outField = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (mask[y * w + x]) {
          if (x >= 10 && x < 45 && y >= 10 && y < 40) inField++;
          else outField++;
        }
    expect(inField).toBe(35 * 30);
    expect(outField).toBe(0);
  });

  it("returns null on a speck and on a runaway region", () => {
    const w = 100, h = 100;
    const speck = image(w, h, SAND, [{ x: 50, y: 50, w: 3, h: 3, c: GREEN }]);
    expect(growRegion(speck, w, h, { x: 51, y: 51 })).toBeNull();
    // Tapping the background floods most of the image -> "not one field".
    const bg = image(w, h, SAND, [{ x: 10, y: 10, w: 20, h: 20, c: GREEN }]);
    expect(growRegion(bg, w, h, { x: 80, y: 80 })).toBeNull();
  });

  it("tolerates in-field texture within the tolerance", () => {
    const w = 60, h = 60;
    const px = image(w, h, SAND, [{ x: 5, y: 5, w: 40, h: 40, c: GREEN }]);
    // Sprinkle mild texture inside the field.
    for (let k = 0; k < 200; k++) {
      const x = 5 + ((k * 7) % 40), y = 5 + ((k * 11) % 40);
      const i = (y * w + x) * 4;
      px[i] = GREEN[0] + 12; px[i + 1] = GREEN[1] - 10; px[i + 2] = GREEN[2] + 8;
    }
    const mask = growRegion(px, w, h, { x: 25, y: 25 })!;
    expect(mask).not.toBeNull();
    let n = 0;
    for (let i = 0; i < w * h; i++) n += mask[i];
    expect(n).toBe(40 * 40);
  });
});

describe("traceContour + simplifyPath", () => {
  it("a rectangle mask simplifies to its four corners", () => {
    const w = 50, h = 50;
    const mask = new Uint8Array(w * h);
    for (let y = 10; y < 40; y++) for (let x = 5; x < 45; x++) mask[y * w + x] = 1;
    const contour = traceContour(mask, w, h);
    expect(contour.length).toBeGreaterThan(100); // full perimeter walked
    const simple = simplifyPath(contour, 2);
    // Four corners (RDP may keep the closing duplicate; both ends near a corner).
    const uniq = new Set(simple.map((p) => `${Math.round(p.x / 3)}:${Math.round(p.y / 3)}`));
    expect(uniq.size).toBeGreaterThanOrEqual(4);
    expect(uniq.size).toBeLessThanOrEqual(6);
  });
});

describe("suggestBoundary — the whole pipeline", () => {
  it("reads a rectangular field back as a small polygon covering it", () => {
    const w = 120, h = 120;
    const px = image(w, h, SAND, [{ x: 20, y: 30, w: 60, h: 50, c: GREEN }]);
    const poly = suggestBoundary(px, w, h, { x: 50, y: 55 })!;
    expect(poly).not.toBeNull();
    expect(poly.length).toBeGreaterThanOrEqual(3);
    expect(poly.length).toBeLessThanOrEqual(14);
    for (const p of poly) {
      expect(p.x).toBeGreaterThanOrEqual(19);
      expect(p.x).toBeLessThanOrEqual(80);
      expect(p.y).toBeGreaterThanOrEqual(29);
      expect(p.y).toBeLessThanOrEqual(80);
    }
    // Shoelace area of the suggestion ≈ the painted field's area.
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      area += a.x * b.y - b.x * a.y;
    }
    area = Math.abs(area) / 2;
    expect(area).toBeGreaterThan(60 * 50 * 0.85);
    expect(area).toBeLessThan(60 * 50 * 1.15);
  });

  it("declines honestly when tapped on unreadable ground", () => {
    const w = 80, h = 80;
    // Pure noise — no coherent region anywhere.
    const px = new Uint8ClampedArray(w * h * 4);
    let s = 42;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = rnd() * 255; px[i * 4 + 1] = rnd() * 255; px[i * 4 + 2] = rnd() * 255; px[i * 4 + 3] = 255;
    }
    expect(suggestBoundary(px, w, h, { x: 40, y: 40 })).toBeNull();
  });

  it("fine detail keeps every small step the default budget must smooth over", () => {
    const w = 200, h = 160;
    // A staircase field: 8 treads widening downwards — ~20 true corners.
    const rects = Array.from({ length: 8 }, (_, i) => ({
      x: 20,
      y: 20 + i * 14,
      w: 40 + i * 14,
      h: 14,
      c: GREEN,
    }));
    const px = image(w, h, SAND, rects);

    const coarse = suggestBoundary(px, w, h, { x: 30, y: 60 })!;
    const fine = suggestBoundary(px, w, h, { x: 30, y: 60 }, { epsilon: 1.15, maxCorners: 64 })!;
    expect(coarse).not.toBeNull();
    expect(fine).not.toBeNull();

    // The default budget cannot hold the staircase; fine detail can.
    expect(coarse.length).toBeLessThanOrEqual(14);
    expect(fine.length).toBeGreaterThanOrEqual(16);
    expect(fine.length).toBeLessThanOrEqual(64);

    // And the fine outline's area matches the painted field tightly.
    const shoelace = (poly: Pt[]) => {
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        a += p.x * q.y - q.x * p.y;
      }
      return Math.abs(a) / 2;
    };
    const painted = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(shoelace(fine)).toBeGreaterThan(painted * 0.88);
    expect(shoelace(fine)).toBeLessThan(painted * 1.12);
  });

  it("caps the corner budget", () => {
    const w = 140, h = 140;
    // A blobby cross shape — many raw contour points.
    const px = image(w, h, SAND, [
      { x: 50, y: 20, w: 40, h: 100, c: GREEN },
      { x: 20, y: 50, w: 100, h: 40, c: GREEN },
    ]);
    const poly = suggestBoundary(px, w, h, { x: 70, y: 70 })!;
    expect(poly).not.toBeNull();
    expect(poly.length).toBeLessThanOrEqual(14);
    expect(poly.length).toBeGreaterThanOrEqual(8); // a cross needs ~12 corners
    expectSimple(poly);
  });

  it("never returns a self-crossing ring", () => {
    // Every shape this suite feeds the pipeline must come back simple.
    const w = 140, h = 140;
    const cases: Array<[Uint8ClampedArray, Pt]> = [
      [image(w, h, SAND, [{ x: 20, y: 30, w: 60, h: 50, c: GREEN }]), { x: 50, y: 55 }],
      [
        image(w, h, SAND, [
          { x: 50, y: 20, w: 40, h: 100, c: GREEN },
          { x: 20, y: 50, w: 100, h: 40, c: GREEN },
        ]),
        { x: 70, y: 70 },
      ],
      [
        image(w, h, SAND, Array.from({ length: 8 }, (_, i) => ({
          x: 20, y: 15 + i * 14, w: 40 + i * 12, h: 14, c: GREEN,
        }))),
        { x: 30, y: 60 },
      ],
    ];
    for (const [px, seed] of cases) {
      const poly = suggestBoundary(px, w, h, seed, { epsilon: 1.15, maxCorners: 64 });
      if (poly) expectSimple(poly);
    }
  });
});
