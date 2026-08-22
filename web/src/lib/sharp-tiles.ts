/**
 * The level-19 close-up layer, made safe.
 *
 * Esri's imagery service answers some level-19 requests with a grey
 * "Map data not yet available" PLACEHOLDER IMAGE — HTTP 200, so a plain
 * raster source happily paints it over the perfectly good overzoomed
 * level-18 imagery beneath (seen live on farmkaro.in). This custom tile
 * protocol fetches each hi-res tile, glances at its pixels, and swallows
 * placeholders so the base layer shows through instead.
 *
 * The failure modes are deliberately asymmetric: dropping a REAL tile only
 * costs a slightly softer view (the overzoomed base remains), while keeping
 * a placeholder paints grey over the land — so the detector is tuned
 * aggressive. Anything near-uniform neutral grey goes.
 */
import maplibregl from "maplibre-gl";

export const HI_TILE_PROTOCOL = "fkhi";

/** 1×1 transparent PNG — what a swallowed placeholder becomes. */
const TRANSPARENT = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

/** Near-uniform neutral grey = placeholder. Mean must sit in the grey band
 *  with all channels close together, and the tile must be low-variance
 *  (the placeholder's faint text barely moves the needle at 16×16). */
async function isPlaceholder(buf: ArrayBuffer): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(new Blob([buf]));
    const size = 16;
    const c = new OffscreenCanvas(size, size);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bmp, 0, 0, size, size);
    bmp.close();
    const d = ctx.getImageData(0, 0, size, size).data;
    let mr = 0,
      mg = 0,
      mb = 0;
    const n = size * size;
    for (let i = 0; i < d.length; i += 4) {
      mr += d[i];
      mg += d[i + 1];
      mb += d[i + 2];
    }
    mr /= n;
    mg /= n;
    mb /= n;
    const neutral = Math.abs(mr - mg) < 14 && Math.abs(mg - mb) < 14;
    const greyBand = mr > 140 && mr < 235;
    if (!neutral || !greyBand) return false;
    let varSum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const mean = 0.299 * mr + 0.587 * mg + 0.114 * mb;
      varSum += (luma - mean) * (luma - mean);
    }
    return Math.sqrt(varSum / n) < 45;
  } catch {
    return false; // can't inspect — keep the tile
  }
}

let registered = false;

/** Register the protocol once per page. Tile URLs use
 *  `fkhi://<real url>` and pass through this filter. */
export function registerSharpTiles(): void {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol(HI_TILE_PROTOCOL, async (params, abortController) => {
    const url = params.url.replace(new RegExp(`^${HI_TILE_PROTOCOL}://`), "");
    const res = await fetch(url, { signal: abortController?.signal });
    if (!res.ok) throw new Error(`hi-res tile ${res.status}`);
    const buf = await res.arrayBuffer();
    if (await isPlaceholder(buf)) return { data: TRANSPARENT.buffer.slice(0) };
    return { data: buf };
  });
}
