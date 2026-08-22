/** Crawl every internal link reachable from the main routes; report dead ones. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SEEDS = ["/", "/discover", "/list-land", "/dashboard/owner", "/dashboard/farmer", "/parcel/p-1", "/parcel/does-not-exist"];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
const links = new Map();   // href -> Set(found-on)
const bad = [];
const errs = new Map();
p.on("pageerror", (e) => { const k = (e.stack||e.message).slice(0,160); errs.set(k, (errs.get(k)||0)+1); });

for (const seed of SEEDS) {
  const res = await p.goto(BASE + seed, { waitUntil: "domcontentloaded" });
  if (seed === "/parcel/does-not-exist") console.log(`  not-found route -> HTTP ${res.status()}`);
  await p.waitForTimeout(2500);
  const found = await p.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll("a")) {
      const h = a.getAttribute("href");
      const txt = (a.textContent||"").trim().slice(0,40);
      out.push({ h, txt, hasHref: h !== null });
    }
    return out;
  });
  for (const f of found) {
    if (!f.hasHref) { bad.push(`${seed}: <a> with NO href — "${f.txt}"`); continue; }
    if (f.h === "#" || f.h === "") { bad.push(`${seed}: dead anchor href="${f.h}" — "${f.txt}"`); continue; }
    if (/^(https?:|mailto:|tel:|data:|wa\.me)/.test(f.h)) continue;
    const url = f.h.split("#")[0];
    if (!url.startsWith("/")) { bad.push(`${seed}: odd href "${f.h}" — "${f.txt}"`); continue; }
    if (!links.has(url)) links.set(url, new Set());
    links.get(url).add(seed);
  }
}
console.log(`\nInternal link targets found: ${links.size}`);
for (const [url, from] of [...links].sort()) {
  const r = await p.request.get(BASE + url);
  const s = r.status();
  const mark = s >= 400 ? "✗" : "✓";
  if (s >= 400) bad.push(`DEAD LINK ${url} -> ${s} (linked from ${[...from].join(", ")})`);
  console.log(`  ${mark} ${s}  ${url}`);
}
console.log("\n=== PROBLEMS ===");
console.log(bad.length ? bad.join("\n") : "none");
console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].map(([k,v])=>`(x${v}) ${k}`).join("\n") : "none");
await b.close();
