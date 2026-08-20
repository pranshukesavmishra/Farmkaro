/**
 * Geospatial primitives.
 *
 * These mirror what PostGIS does server-side (ST_Area on the geography cast,
 * ST_Centroid, ST_Envelope, ST_DWithin). They exist client-side so a boundary
 * drawn or imported in the browser reports the same acreage the database will
 * compute on write — an owner who knows his land will notice a mismatch.
 *
 * Area is spherical, never planar-in-degrees.
 */

export type Position = [number, number]; // [lng, lat]
export type Ring = Position[];
export type PolygonCoords = Ring[]; // [outer, ...holes]

export const EARTH_RADIUS_M = 6378137;
export const SQ_M_PER_ACRE = 4046.8564224;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Spherical ring area in m² (signed). Matches ST_Area(geom::geography). */
function ringAreaM2(ring: Ring): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lo1, la1] = ring[i];
    const [lo2, la2] = ring[(i + 1) % ring.length];
    total += rad(lo2 - lo1) * (2 + Math.sin(rad(la1)) + Math.sin(rad(la2)));
  }
  return (total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2;
}

export function polygonAreaM2(coords: PolygonCoords): number {
  if (!coords.length) return 0;
  const outer = Math.abs(ringAreaM2(coords[0]));
  const holes = coords.slice(1).reduce((s, r) => s + Math.abs(ringAreaM2(r)), 0);
  return Math.max(0, outer - holes);
}

export const m2ToAcres = (m2: number) => m2 / SQ_M_PER_ACRE;

/** Great-circle distance in metres. */
export function haversineM(a: Position, b: Position): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function perimeterM(ring: Ring): number {
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    total += haversineM(ring[i], ring[(i + 1) % ring.length]);
  }
  return total;
}

export function centroid(coords: PolygonCoords): Position {
  const ring = coords[0] ?? [];
  if (!ring.length) return [0, 0];
  let x = 0,
    y = 0,
    area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-12) {
    const n = ring.length;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  area *= 0.5;
  return [x / (6 * area), y / (6 * area)];
}

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export function bboxOf(coords: PolygonCoords): BBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const ring of coords) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

export const bboxIntersects = (a: BBox, b: BBox) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/* ---------------------------------------------------------------------------
 * Web Mercator tile maths.
 *
 * Used by ParcelOverlayCard to place a real satellite tile grid behind a
 * parcel and project its true boundary into the same pixel space — so the
 * dashed outline follows the actual geometry, never a decorative shape.
 * ------------------------------------------------------------------------- */

export const TILE_SIZE = 256;

export const lngToTileX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;

export function latToTileY(lat: number, z: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const s = Math.sin(rad(clamped));
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z;
}

/**
 * Pick the deepest zoom at which `bbox` (plus padding) still fits inside a
 * frame of `width` x `height` CSS pixels.
 */
export function fitZoom(bbox: BBox, width: number, height: number, pad = 1.45, maxZoom = 18): number {
  for (let z = maxZoom; z >= 1; z--) {
    const w = (lngToTileX(bbox[2], z) - lngToTileX(bbox[0], z)) * TILE_SIZE * pad;
    const h = (latToTileY(bbox[1], z) - latToTileY(bbox[3], z)) * TILE_SIZE * pad;
    if (w <= width && h <= height) return z;
  }
  return 1;
}

export interface TileFrame {
  zoom: number;
  /** Fractional world-pixel origin of the frame's top-left corner. */
  originPx: { x: number; y: number };
  tiles: { x: number; y: number; z: number; left: number; top: number }[];
  project: (p: Position) => { x: number; y: number };
}

/** Build the tile grid + projector needed to render `bbox` centred in a frame. */
export function buildTileFrame(bbox: BBox, width: number, height: number, pad = 1.45): TileFrame {
  const zoom = fitZoom(bbox, width, height, pad);
  const scale = TILE_SIZE;
  const cx = (lngToTileX(bbox[0], zoom) + lngToTileX(bbox[2], zoom)) / 2;
  const cy = (latToTileY(bbox[1], zoom) + latToTileY(bbox[3], zoom)) / 2;

  const originX = cx * scale - width / 2;
  const originY = cy * scale - height / 2;

  const firstX = Math.floor(originX / scale);
  const firstY = Math.floor(originY / scale);
  const lastX = Math.floor((originX + width) / scale);
  const lastY = Math.floor((originY + height) / scale);

  const n = 2 ** zoom;
  const tiles: TileFrame["tiles"] = [];
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      if (ty < 0 || ty >= n) continue;
      tiles.push({
        x: ((tx % n) + n) % n,
        y: ty,
        z: zoom,
        left: tx * scale - originX,
        top: ty * scale - originY,
      });
    }
  }

  return {
    zoom,
    originPx: { x: originX, y: originY },
    tiles,
    project: ([lng, lat]) => ({
      x: lngToTileX(lng, zoom) * scale - originX,
      y: latToTileY(lat, zoom) * scale - originY,
    }),
  };
}

/** Free satellite basemap — no API key. Swap via NEXT_PUBLIC_SATELLITE_TILE_URL. */
export const SATELLITE_TILE_URL =
  process.env.NEXT_PUBLIC_SATELLITE_TILE_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const tileUrl = (x: number, y: number, z: number) =>
  SATELLITE_TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

/** Format an acreage the way an Indian landowner reads it. */
export function formatAcres(acres: number): string {
  return acres < 10 ? acres.toFixed(2) : acres.toFixed(1);
}

export function formatINR(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}
