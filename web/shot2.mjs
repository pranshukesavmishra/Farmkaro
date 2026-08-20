import { chromium } from "playwright";
// Screenshot the draw step: select village, continue, click 4 corners on the map.
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
await p.goto("http://localhost:3000/list-land", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.selectOption("#village", "Panagar");
await p.click("text=Continue");
await p.waitForTimeout(3500); // map load
const map = await p.locator(".maplibregl-canvas").boundingBox();
if (map) {
  const cx = map.x + map.width / 2, cy = map.y + map.height / 2;
  const pts = [[cx-140, cy-90],[cx+130, cy-110],[cx+160, cy+80],[cx-120, cy+110]];
  for (const [x,y] of pts) { await p.mouse.click(x, y); await p.waitForTimeout(350); }
}
await p.waitForTimeout(1200);
await p.screenshot({ path: "/tmp/listland-draw.png" });
await b.close();
console.log("done");
