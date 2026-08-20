import { NextResponse } from "next/server";
import { deflateSync } from "node:zlib";

/**
 * Offline development basemap.
 *
 * Generates a deterministic, farmland-like raster stand-in so the map, the
 * ParcelOverlayCard projection and every layout can be developed and
 * screenshot-tested without reaching an external tile host. Never used in
 * production: set NEXT_PUBLIC_SATELLITE_TILE_URL to a real provider.
 *
 * Emitted as PNG (not SVG): MapLibre's raster tile decoder uses
 * createImageBitmap, which cannot decode SVG blobs, so an SVG tile leaves the
 * map stuck at "Loading map…" while <img>-based views happily render it.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIELD_TONES: [number, number, number][] = [
  [0x4a, 0x5c, 0x33], [0x5c, 0x6f, 0x3c], [0x6b, 0x7c, 0x45], [0x7d, 0x8a, 0x4e],
  [0x8d, 0x94, 0x55], [0x3f, 0x52, 0x30], [0x55, 0x67, 0x3a], [0x6f, 0x7f, 0x4a],
  [0x94, 0xa0, 0x5f], [0xa8, 0xac, 0x74], [0x3a, 0x4a, 0x2c], [0x63, 0x73, 0x41],
];

const SIZE = 256;

/* ---- minimal PNG encoder (RGB, no filter) -------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(head.length + 8);
  out.writeUInt32BE(data.length, 0);
  head.copy(out, 4);
  out.writeUInt32BE(crc32(head), head.length + 4);
  return out;
}

function encodePng(rgb: Buffer, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- tile painting ------------------------------------------------------- */

function paintTile(seed: number): Buffer {
  const r = rng(Math.abs(seed) || 1);
  const px = Buffer.alloc(SIZE * SIZE * 3);

  const fillRect = (x0: number, y0: number, w: number, h: number, tone: [number, number, number]) => {
    const xa = Math.max(0, Math.floor(x0));
    const ya = Math.max(0, Math.floor(y0));
    const xb = Math.min(SIZE, Math.ceil(x0 + w));
    const yb = Math.min(SIZE, Math.ceil(y0 + h));
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) {
        const i = (y * SIZE + x) * 3;
        px[i] = tone[0];
        px[i + 1] = tone[1];
        px[i + 2] = tone[2];
      }
    }
  };

  // Irregular field strips, the way cadastral farmland actually reads from above.
  let yCursor = -20;
  while (yCursor < SIZE) {
    const h = 26 + r() * 62;
    let xCursor = -20;
    while (xCursor < SIZE) {
      const w = 34 + r() * 90;
      const tone = FIELD_TONES[Math.floor(r() * FIELD_TONES.length)];
      fillRect(xCursor, yCursor, w + 1, h + 1, tone);
      xCursor += w;
    }
    yCursor += h;
  }

  // Field bunds for texture: soft wavy horizontal lines, alpha-blended.
  for (let i = 0; i < 5; i++) {
    const y0 = r() * SIZE;
    const amp = (r() - 0.5) * 40;
    const width = 1 + r() * 2;
    for (let x = 0; x < SIZE; x++) {
      const yc = y0 + Math.sin((x / SIZE) * Math.PI) * amp;
      for (let dy = 0; dy < width; dy++) {
        const y = Math.round(yc) + dy;
        if (y < 0 || y >= SIZE) continue;
        const idx = (y * SIZE + x) * 3;
        px[idx] = (px[idx] * 0.65 + 120 * 0.35) | 0;
        px[idx + 1] = (px[idx + 1] * 0.65 + 110 * 0.35) | 0;
        px[idx + 2] = (px[idx + 2] * 0.65 + 80 * 0.35) | 0;
      }
    }
  }

  // Gentle radial vignette so tiles do not read perfectly flat.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - 128) / 128;
      const dy = (y - 128) / 128;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const f = 1 + 0.045 - d * 0.1;
      const i = (y * SIZE + x) * 3;
      px[i] = Math.max(0, Math.min(255, px[i] * f)) | 0;
      px[i + 1] = Math.max(0, Math.min(255, px[i + 1] * f)) | 0;
      px[i + 2] = Math.max(0, Math.min(255, px[i + 2] * f)) | 0;
    }
  }

  return px;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await ctx.params;
  const seed = (Number(z) * 73856093) ^ (Number(x) * 19349663) ^ (Number(y) * 83492791);
  const png = encodePng(paintTile(seed), SIZE, SIZE);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
