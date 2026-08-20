import { NextResponse } from "next/server";

/**
 * Offline development basemap.
 *
 * Generates a deterministic, farmland-like raster stand-in so the map, the
 * ParcelOverlayCard projection and every layout can be developed and
 * screenshot-tested without reaching an external tile host. Never used in
 * production: set NEXT_PUBLIC_SATELLITE_TILE_URL to a real provider.
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

const FIELD_TONES = [
  "#4a5c33", "#5c6f3c", "#6b7c45", "#7d8a4e", "#8d9455",
  "#3f5230", "#55673a", "#6f7f4a", "#94a05f", "#a8ac74",
  "#3a4a2c", "#63734180",
];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await ctx.params;
  const seed = (Number(z) * 73856093) ^ (Number(x) * 19349663) ^ (Number(y) * 83492791);
  const r = rng(Math.abs(seed) || 1);

  const cells: string[] = [];
  // Irregular field strips, the way cadastral farmland actually reads from above.
  let yCursor = -20;
  while (yCursor < 256) {
    const h = 26 + r() * 62;
    let xCursor = -20;
    while (xCursor < 256) {
      const w = 34 + r() * 90;
      const tone = FIELD_TONES[Math.floor(r() * FIELD_TONES.length)];
      const skew = (r() - 0.5) * 10;
      cells.push(
        `<polygon points="${xCursor},${yCursor} ${xCursor + w},${yCursor + skew} ${xCursor + w},${yCursor + h + skew} ${xCursor},${yCursor + h}" fill="${tone}"/>`,
      );
      xCursor += w;
    }
    yCursor += h;
  }

  // Field bunds and a watercourse for texture.
  const lines: string[] = [];
  for (let i = 0; i < 5; i++) {
    const y0 = r() * 256;
    lines.push(
      `<path d="M0,${y0.toFixed(0)} Q${(60 + r() * 60).toFixed(0)},${(y0 + (r() - 0.5) * 40).toFixed(0)} 256,${(y0 + (r() - 0.5) * 60).toFixed(0)}" stroke="rgba(120,110,80,.35)" stroke-width="${(0.6 + r() * 1.6).toFixed(1)}" fill="none"/>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<rect width="256" height="256" fill="#5b6b3e"/>${cells.join("")}${lines.join("")}
<rect width="256" height="256" fill="url(#g)" opacity=".18"/>
<defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient></defs>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
