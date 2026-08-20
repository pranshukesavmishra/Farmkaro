import { describe, expect, it } from "vitest";
import {
  bboxIntersects,
  bboxOf,
  buildTileFrame,
  centroid,
  formatINR,
  haversineM,
  m2ToAcres,
  polygonAreaM2,
  type PolygonCoords,
} from "@/lib/geo";

/** ~100m x ~100m square near Jabalpur (23.18N). 1 deg lat ~ 110.57 km,
 *  1 deg lng ~ 102.4 km at this latitude. */
function squareAt(lng: number, lat: number, meters: number): PolygonCoords {
  const dLat = meters / 110574;
  const dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [
      [lng, lat],
      [lng + dLng, lat],
      [lng + dLng, lat + dLat],
      [lng, lat + dLat],
      [lng, lat],
    ],
  ];
}

describe("spherical area (mirrors ST_Area on geography)", () => {
  it("computes a 100m square as ~10,000 m² within 1%", () => {
    const area = polygonAreaM2(squareAt(79.98, 23.18, 100));
    expect(area).toBeGreaterThan(9900);
    expect(area).toBeLessThan(10100);
  });

  it("one hectare is ~2.47 acres", () => {
    expect(m2ToAcres(10000)).toBeCloseTo(2.4711, 3);
  });

  it("degenerate ring has zero area", () => {
    expect(polygonAreaM2([[[79, 23], [79, 23], [79, 23]]])).toBe(0);
    expect(polygonAreaM2([])).toBe(0);
  });

  it("holes subtract from the outer ring", () => {
    const outer = squareAt(79.98, 23.18, 100)[0];
    const hole = squareAt(79.9803, 23.1803, 30)[0];
    const withHole = polygonAreaM2([outer, hole]);
    expect(withHole).toBeLessThan(polygonAreaM2([outer]));
    expect(withHole).toBeGreaterThan(polygonAreaM2([outer]) - 1000);
  });
});

describe("haversine distance", () => {
  it("1 degree of latitude is ~110.57 km", () => {
    const d = haversineM([79.98, 23], [79.98, 24]);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(111500);
  });
  it("zero distance for identical points", () => {
    expect(haversineM([79.98, 23.18], [79.98, 23.18])).toBe(0);
  });
});

describe("bbox", () => {
  const sq = squareAt(79.98, 23.18, 100);
  it("bboxOf bounds the ring", () => {
    const [minX, minY, maxX, maxY] = bboxOf(sq);
    expect(minX).toBeLessThan(maxX);
    expect(minY).toBeLessThan(maxY);
  });
  it("intersection is symmetric and detects disjoint boxes", () => {
    const a = bboxOf(sq);
    const b = bboxOf(squareAt(80.5, 23.5, 100));
    expect(bboxIntersects(a, a)).toBe(true);
    expect(bboxIntersects(a, b)).toBe(false);
    expect(bboxIntersects(b, a)).toBe(false);
  });
});

describe("tile frame projection", () => {
  it("projects the bbox centre to the frame centre", () => {
    const sq = squareAt(79.98, 23.18, 200);
    const frame = buildTileFrame(bboxOf(sq), 400, 300);
    const [minX, minY, maxX, maxY] = bboxOf(sq);
    const c = frame.project([(minX + maxX) / 2, (minY + maxY) / 2]);
    expect(c.x).toBeCloseTo(200, 0);
    expect(c.y).toBeCloseTo(150, 0);
  });
  it("keeps the whole polygon inside the frame", () => {
    const sq = squareAt(79.98, 23.18, 500);
    const frame = buildTileFrame(bboxOf(sq), 400, 300);
    for (const pt of sq[0]) {
      const p = frame.project(pt);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(400);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(300);
    }
  });
});

describe("INR formatting", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(354500)).toBe("₹3,54,500");
  });
  it("compact lakhs", () => {
    expect(formatINR(350000, { compact: true })).toBe("₹3.5L");
  });
});
