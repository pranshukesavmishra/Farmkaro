/** The sweep beam must stay inside the polygon — including concave shapes,
 *  where one beam position crosses the boundary four times. */
import { describe, expect, it } from "vitest";
import { sweepRange, sweepSegments, type Px } from "@/lib/sweep";

const N: Px = { x: 0, y: 1 }; // horizontal beam sweeping downwards

describe("sweepSegments", () => {
  it("crosses a rectangle as one full-width segment", () => {
    const rect: Px[] = [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 60 },
      { x: 10, y: 60 },
    ];
    const segs = sweepSegments(rect, N, 35);
    expect(segs).toHaveLength(1);
    const [a, b] = segs[0];
    expect(Math.min(a.x, b.x)).toBeCloseTo(10, 5);
    expect(Math.max(a.x, b.x)).toBeCloseTo(110, 5);
    expect(a.y).toBeCloseTo(35, 5);
    expect(b.y).toBeCloseTo(35, 5);
  });

  it("splits into two segments inside a U shape, skipping the gap", () => {
    // A "U": two vertical arms joined at the bottom.
    const u: Px[] = [
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 60 }, { x: 60, y: 60 },
      { x: 60, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }, { x: 0, y: 80 },
    ];
    const segs = sweepSegments(u, N, 30); // through both arms, above the base
    expect(segs).toHaveLength(2);
    const xs = segs.flat().map((p) => p.x).sort((p, q) => p - q);
    expect(xs[0]).toBeCloseTo(0, 5);
    expect(xs[1]).toBeCloseTo(20, 5);
    expect(xs[2]).toBeCloseTo(60, 5);
    expect(xs[3]).toBeCloseTo(80, 5);
    // Nothing drawn across the mouth of the U (20..60).
    for (const [a, b] of segs) {
      const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      expect(hi <= 20 + 1e-6 || lo >= 60 - 1e-6).toBe(true);
    }
  });

  it("returns nothing outside the shape", () => {
    const rect: Px[] = [
      { x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 60 }, { x: 10, y: 60 },
    ];
    expect(sweepSegments(rect, N, 5)).toHaveLength(0);
    expect(sweepSegments(rect, N, 90)).toHaveLength(0);
  });

  it("range covers the shape with padding on both sides", () => {
    const rect: Px[] = [
      { x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 60 }, { x: 10, y: 60 },
    ];
    const { min, max } = sweepRange(rect, N, 16);
    expect(min).toBeCloseTo(10 - 16, 5);
    expect(max).toBeCloseTo(60 + 16, 5);
  });
});
