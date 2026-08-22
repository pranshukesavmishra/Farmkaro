/** One link per result card, and the whole card is the target. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();

for (const route of ["/", "/discover", "/dashboard/owner", "/dashboard/farmer"]) {
  await p.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  const dups = await p.evaluate(() => {
    const out = [];
    for (const card of document.querySelectorAll("article")) {
      const hrefs = [...card.querySelectorAll("a[href^='/parcel/']")].map((a) => a.getAttribute("href"));
      const counts = {};
      hrefs.forEach((h) => (counts[h] = (counts[h] || 0) + 1));
      for (const [h, n] of Object.entries(counts)) if (n > 1) out.push(`${h} x${n}`);
    }
    return out;
  });
  check(dups.length === 0, `${route}: no card repeats the same parcel link ${dups.length ? "— " + dups.join(", ") : ""}`);
}

// The whole card must navigate: click a spot with no text link on it.
await p.goto(BASE + "/discover", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const card = p.locator("article").filter({ has: p.locator("a[href^='/parcel/']") }).first();
const href = await card.locator("a[href^='/parcel/']").first().getAttribute("href");
const box = await card.boundingBox();
await card.scrollIntoViewIfNeeded();
await p.waitForTimeout(500);
const b2 = await card.boundingBox();
// Bottom-left of the card body — the "GPS location captured" strip, not a link.
await p.mouse.click(b2.x + 60, b2.y + b2.height - 14);
await p.waitForTimeout(2500);
check(p.url().includes(href), `clicking dead space on the card navigates to ${href} (landed on ${new URL(p.url()).pathname})`);

// Keyboard: exactly one tab stop per card for the parcel link.
await p.goto(BASE + "/discover", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const stops = await p.evaluate(() => {
  const sel = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";
  const cards = [...document.querySelectorAll("article")].filter((c) => c.querySelector("a[href^='/parcel/']"));
  return cards.slice(0, 4).map((c) => [...c.querySelectorAll(sel)].length);
});
check(stops.every((n) => n === 1), `each card exposes exactly one tab stop (${stops.join(", ")})`);

console.log(fail ? `\n${fail} FAILED` : "\nCARDS: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
