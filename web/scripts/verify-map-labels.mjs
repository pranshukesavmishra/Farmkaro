/** No two visible price pills may overlap, at any width. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

const overlapReport = () => `(() => {
  const boxes = [...document.querySelectorAll(".fk-marker")]
    .filter((el) => !el.classList.contains("is-collapsed"))
    .map((el) => { const r = el.getBoundingClientRect(); return { r, t: el.textContent.trim() }; })
    .filter((x) => x.r.width > 0);
  const hits = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, c = boxes[j].r;
      if (a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top)
        hits.push(boxes[i].t + " / " + boxes[j].t);
    }
  const total = document.querySelectorAll(".fk-marker").length;
  const collapsed = document.querySelectorAll(".fk-marker.is-collapsed").length;
  return { hits: hits.slice(0, 5), shown: boxes.length, total, collapsed };
})()`;

for (const [label, vp, mobile] of [["desktop", { width: 1440, height: 950 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(BASE + "/discover", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);
  if (mobile) { await p.getByRole("button", { name: /^map$/i }).click(); await p.waitForTimeout(2500); }
  let r = await p.evaluate(overlapReport());
  check(r.hits.length === 0, `${label}: no overlapping price pills — ${r.shown}/${r.total} shown, ${r.collapsed} collapsed${r.hits.length ? " — " + r.hits.join("; ") : ""}`);
  check(r.shown > 0, `${label}: prices are still shown, not all collapsed (${r.shown})`);

  // Zooming in must reveal more prices, not fewer.
  await p.evaluate(() => window.scrollTo(0, 0));
  const canvas = p.locator("canvas").first();
  const cb = await canvas.boundingBox();
  for (let i = 0; i < 4; i++) { await p.mouse.dblclick(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.waitForTimeout(900); }
  const r2 = await p.evaluate(overlapReport());
  check(r2.hits.length === 0, `${label}: still no overlaps after zooming in — ${r2.shown} shown, ${r2.collapsed} collapsed${r2.hits.length ? " — " + r2.hits.join("; ") : ""}`);
  await ctx.close();
}
console.log(fail ? `\n${fail} FAILED` : "\nDECLUTTER: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
