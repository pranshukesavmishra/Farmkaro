/**
 * Sweep-line scan for a selected boundary — the single moving light beam
 * that glides across a marked field (distinct from the dash circulating
 * around its edge).
 *
 * The beam is the line  dot(p, n) = c  for a fixed unit normal n and a value
 * of c animated across the polygon's extent. What gets drawn is only the
 * parts of that line INSIDE the polygon: intersect it with every edge, sort
 * the crossings along the beam, and pair them even–odd. Pure pixel-space
 * geometry — the caller projects, animates c, and unprojects the result.
 */

export interface Px {
  x: number;
  y: number;
}

/**
 * Segments of the beam dot(p,n)=c that lie inside the (possibly concave)
 * polygon `ring` (unclosed; last->first edge implied). Decorative maths:
 * a crossing exactly on a vertex can double-count for a single frame,
 * which the eye never catches at 60fps.
 */
export function sweepSegments(ring: Px[], n: Px, c: number): Array<[Px, Px]> {
  if (ring.length < 3) return [];
  const d = { x: -n.y, y: n.x }; // direction along the beam
  const hits: Array<{ t: number; p: Px }> = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const fa = a.x * n.x + a.y * n.y - c;
    const fb = b.x * n.x + b.y * n.y - c;
    if ((fa > 0 && fb > 0) || (fa < 0 && fb < 0)) continue; // edge fully one side
    const denom = fa - fb;
    if (Math.abs(denom) < 1e-12) continue; // edge lies along the beam
    const t = fa / denom;
    if (t < 0 || t > 1) continue;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    hits.push({ t: p.x * d.x + p.y * d.y, p });
  }
  hits.sort((u, v) => u.t - v.t);
  const segs: Array<[Px, Px]> = [];
  for (let i = 0; i + 1 < hits.length; i += 2) segs.push([hits[i].p, hits[i + 1].p]);
  return segs;
}

/** The beam's travel range: min/max of dot(p,n) over the ring, padded so the
 *  sweep enters and leaves the shape cleanly. */
export function sweepRange(ring: Px[], n: Px, pad = 16): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of ring) {
    const c = p.x * n.x + p.y * n.y;
    if (c < min) min = c;
    if (c > max) max = c;
  }
  return { min: min - pad, max: max + pad };
}
