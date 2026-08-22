/**
 * AI boundary suggestion — the actual computer vision, pure and testable.
 *
 * From a tap inside a field, read the satellite pixels on screen and propose
 * the field's outline: grow a region of similar colour from the tap
 * (fields are visually homogeneous patches), trace the region's contour,
 * and simplify it to a handful of draggable corners.
 *
 * Honesty contract: the output is a SUGGESTION the owner corrects and
 * confirms. It enters the product as owner-drawn geometry — never a claim
 * of surveyed truth — and the UI says so next to the button that runs it.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Mean colour of the (2r+1)² block around the seed — steadier than 1px. */
function seedColour(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  seed: Pt,
  r = 2,
): [number, number, number] {
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = seed.x + dx,
        y = seed.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      sr += rgba[i];
      sg += rgba[i + 1];
      sb += rgba[i + 2];
      n++;
    }
  }
  return [sr / n, sg / n, sb / n];
}

/**
 * Region-grow a mask of pixels whose colour sits within `tolerance` of the
 * seed neighbourhood's mean (Euclidean RGB distance). Returns null when the
 * region is degenerate — a few pixels, or so large it is clearly not one
 * field — because a wrong suggestion is worse than none.
 */
export function growRegion(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  seed: Pt,
  tolerance = 34,
): Uint8Array | null {
  if (seed.x < 0 || seed.y < 0 || seed.x >= w || seed.y >= h) return null;
  const [cr, cg, cb] = seedColour(rgba, w, h, seed);
  const tol2 = tolerance * tolerance;
  const mask = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let head = 0,
    tail = 0,
    count = 0;
  qx[tail] = seed.x;
  qy[tail] = seed.y;
  tail++;
  mask[seed.y * w + seed.x] = 1;

  while (head < tail) {
    const x = qx[head],
      y = qy[head];
    head++;
    count++;
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const;
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const idx = ny * w + nx;
      if (mask[idx]) continue;
      const i = idx * 4;
      const dr = rgba[i] - cr,
        dg = rgba[i + 1] - cg,
        db = rgba[i + 2] - cb;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      mask[idx] = 1;
      qx[tail] = nx;
      qy[tail] = ny;
      tail++;
    }
  }

  const total = w * h;
  if (count < total * 0.002 || count < 60) return null; // a speck, not a field
  if (count > total * 0.6) return null; // ran away — not one field
  return mask;
}

/** One pass of 3×3 majority smoothing — knocks single-pixel noise off. */
export function smoothMask(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) n += mask[(y + dy) * w + (x + dx)];
      out[y * w + x] = n >= 5 ? 1 : 0;
    }
  }
  return out;
}

/**
 * Moore-neighbour contour trace, clockwise from the top-left-most pixel of
 * the mask. Returns the boundary path in pixel coordinates.
 */
export function traceContour(mask: Uint8Array, w: number, h: number): Pt[] {
  let start: Pt | null = null;
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        start = { x, y };
        break outer;
      }
    }
  }
  if (!start) return [];

  // Moore neighbourhood, clockwise starting west.
  const DIRS = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ] as const;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;

  const path: Pt[] = [start];
  let cur = start;
  let dir = 6; // entered from the south
  const limit = w * h * 4;
  for (let step = 0; step < limit; step++) {
    let found = -1;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8; // start looking backwards-right of entry
      const nx = cur.x + DIRS[d][0],
        ny = cur.y + DIRS[d][1];
      if (at(nx, ny)) {
        found = d;
        cur = { x: nx, y: ny };
        break;
      }
    }
    if (found < 0) break; // isolated pixel
    dir = found;
    if (cur.x === start.x && cur.y === start.y) break;
    path.push(cur);
  }
  return path;
}

/** Ramer–Douglas–Peucker simplification. */
export function simplifyPath(path: Pt[], epsilon: number): Pt[] {
  if (path.length < 3) return path;
  const dmax = { d: 0, i: 0 };
  const a = path[0],
    b = path[path.length - 1];
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
    if (d > dmax.d) {
      dmax.d = d;
      dmax.i = i;
    }
  }
  if (dmax.d <= epsilon) return [a, b];
  const left = simplifyPath(path.slice(0, dmax.i + 1), epsilon);
  const right = simplifyPath(path.slice(dmax.i), epsilon);
  return [...left.slice(0, -1), ...right];
}

export interface SuggestOptions {
  tolerance?: number;
  /** RDP epsilon in pixels; larger = fewer corners. */
  epsilon?: number;
  /** Corner budget: epsilon is raised until the count fits. */
  maxCorners?: number;
}

/**
 * The whole pipeline: pixels + a tap → a simplified boundary in pixel
 * coordinates, or null when no clear field could be read there.
 */
export function suggestBoundary(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  seed: Pt,
  opts: SuggestOptions = {},
): Pt[] | null {
  const { tolerance = 34, maxCorners = 14 } = opts;
  let epsilon = opts.epsilon ?? 2.5;

  const grown = growRegion(rgba, w, h, seed, tolerance);
  if (!grown) return null;
  const mask = smoothMask(grown, w, h);
  const contour = traceContour(mask, w, h);
  if (contour.length < 8) return null;

  let simple = simplifyPath(contour, epsilon);
  for (let guard = 0; simple.length > maxCorners && guard < 8; guard++) {
    epsilon *= 1.6;
    simple = simplifyPath(contour, epsilon);
  }
  // Drop the duplicated closing point RDP can leave.
  if (
    simple.length > 1 &&
    simple[0].x === simple[simple.length - 1].x &&
    simple[0].y === simple[simple.length - 1].y
  ) {
    simple = simple.slice(0, -1);
  }
  return simple.length >= 3 ? simple : null;
}
