/** Exercise every Discover control and assert the result set actually reacts. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
const errs = new Set();
p.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 200)));

const count = async () => {
  const t = await p.getByText(/\d+\s+results?/i).first().textContent().catch(() => "");
  return parseInt((t || "").match(/(\d+)/)?.[1] ?? "-1", 10);
};

await p.goto(BASE + "/discover", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const base = await count();
check(base > 0, `baseline result count = ${base}`);

// Radius
await p.getByLabel("Search radius").selectOption({ index: 0 });
await p.waitForTimeout(1200);
const small = await count();
check(small >= 0 && small <= base, `narrowing the radius does not widen results (${base} -> ${small})`);
await p.getByLabel("Search radius").selectOption({ index: 3 });
await p.waitForTimeout(1200);
const wide = await count();
check(wide >= small, `widening the radius restores results (${small} -> ${wide})`);
// Back to the default 20 km, or every later count is measured against a
// different radius than the baseline.
await p.getByLabel("Search radius").selectOption("20");
await p.waitForTimeout(1200);
check((await count()) === base, "restoring the default radius restores the baseline count");

// Water source
const waterOpts = await p.getByLabel("Water source").locator("option").allTextContents();
await p.getByLabel("Water source").selectOption({ index: 1 });
await p.waitForTimeout(1200);
const water = await count();
check(water >= 0 && water <= base, `water filter "${waterOpts[1]}" narrows (${base} -> ${water})`);
await p.getByLabel("Water source").selectOption({ index: 0 });
await p.waitForTimeout(900);

// Acres
await p.getByLabel("Minimum acres").fill("8");
await p.waitForTimeout(1200);
const minAc = await count();
check(minAc >= 0 && minAc < base, `min acres 8 narrows (${base} -> ${minAc})`);
const acresShown = await p.locator("main").innerText();
const acreVals = [...acresShown.matchAll(/([\d.]+)\s*ac\b/g)].map((m) => parseFloat(m[1])).filter((n) => n > 0 && n < 1000);
check(acreVals.length === 0 || Math.min(...acreVals) >= 8, `every listed parcel is >= 8 ac (min shown ${acreVals.length ? Math.min(...acreVals) : "n/a"})`);
await p.getByLabel("Minimum acres").fill("");
await p.getByLabel("Maximum acres").fill("3");
await p.waitForTimeout(1200);
const maxAc = await count();
check(maxAc >= 0 && maxAc < base, `max acres 3 narrows (${base} -> ${maxAc})`);
await p.getByLabel("Maximum acres").fill("");
await p.waitForTimeout(900);

// Rent
await p.getByLabel(/Maximum rent per acre/i).fill("20000");
await p.waitForTimeout(1200);
const rent = await count();
check(rent >= 0 && rent < base, `max rent 20000/ac narrows (${base} -> ${rent})`);
const rentText = await p.locator("main").innerText();
const perAcre = [...rentText.matchAll(/₹([\d,]+)\/ac\b/g)].map((m) => +m[1].replace(/,/g, ""));
check(perAcre.length === 0 || Math.max(...perAcre) <= 20000, `every listed rent is <= 20000/ac (max shown ${perAcre.length ? Math.max(...perAcre) : "n/a"})`);
await p.getByLabel(/Maximum rent per acre/i).fill("");
await p.waitForTimeout(900);

// Crop
await p.getByLabel("Crop").fill("Wheat");
await p.waitForTimeout(1200);
const crop = await count();
check(crop >= 0, `crop filter returns a defined count (${crop})`);
await p.getByLabel("Crop").fill("");
await p.waitForTimeout(900);

// Electricity
const elec = p.getByLabel(/electricity/i).first();
if (await elec.count()) {
  await elec.check();
  await p.waitForTimeout(1200);
  const e = await count();
  check(e >= 0 && e <= base, `electricity filter narrows (${base} -> ${e})`);
  await elec.uncheck();
  await p.waitForTimeout(900);
}

// Sort
const sortOpts = await p.getByLabel("Sort order").locator("option").allTextContents();
for (let i = 0; i < sortOpts.length; i++) {
  await p.getByLabel("Sort order").selectOption({ index: i });
  await p.waitForTimeout(1000);
  const c = await count();
  check(c === base, `sort "${sortOpts[i].trim()}" keeps the same ${base} results, reordered`);
}
await p.getByLabel("Sort order").selectOption({ index: 0 });
await p.waitForTimeout(800);

// Place search (keyless geocoder; may be blocked in this sandbox)
await p.getByLabel("Search a place").fill("Panagar");
await p.getByRole("button", { name: /^go$/i }).click();
await p.waitForTimeout(4000);
const afterSearch = await p.locator("main").innerText();
check(!/undefined|NaN|\[object/i.test(afterSearch), "place search leaves no undefined/NaN in the UI");

// Selecting a card
const card = p.locator("main a[href^='/parcel/']").first();
check((await card.count()) > 0, "result cards link to their parcel");

console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].join("\n") : "none");
if (errs.size) fail++;
console.log(fail ? `\n${fail} FAILED` : "\nDISCOVER: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
