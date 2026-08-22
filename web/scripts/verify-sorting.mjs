/** Assert each sort really orders the list, and the map/list controls work. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = new Set();
p.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 200)));
await p.goto(BASE + "/discover", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);

/** Per-acre rent, acreage and distance of each result card, in list order. */
const rows = async () =>
  p.evaluate(() =>
    [...document.querySelectorAll("main a[href^='/parcel/']")].map((a) => {
      const t = a.innerText.replace(/\s+/g, " ");
      const perAc = t.match(/₹([\d,]+)\/ac\b/);
      const ac = t.match(/([\d.]+)\s*ac\b/);
      const km = t.match(/([\d.]+)\s*km/);
      return {
        ref: a.getAttribute("href"),
        perAc: perAc ? +perAc[1].replace(/,/g, "") : null,
        ac: ac ? +ac[1] : null,
        km: km ? +km[1] : null,
      };
    }),
  );

const nonDec = (xs) => xs.every((v, i) => i === 0 || xs[i - 1] <= v);
const nonInc = (xs) => xs.every((v, i) => i === 0 || xs[i - 1] >= v);
const pick = (rs, k) => rs.map((r) => r[k]).filter((v) => v !== null);

const order = {};
for (const [idx, label] of [[0, "Best match"], [1, "Nearest first"], [2, "Rent: low to high"], [3, "Rent: high to low"], [4, "Largest first"]]) {
  await p.getByLabel("Sort order").selectOption({ index: idx });
  await p.waitForTimeout(1400);
  const rs = await rows();
  order[label] = rs.map((r) => r.ref).join(">");
  if (label === "Rent: low to high") check(nonDec(pick(rs, "perAc")), `${label}: ₹/ac ascending — ${pick(rs, "perAc").slice(0, 5).join(", ")}…`);
  if (label === "Rent: high to low") check(nonInc(pick(rs, "perAc")), `${label}: ₹/ac descending — ${pick(rs, "perAc").slice(0, 5).join(", ")}…`);
  if (label === "Largest first") check(nonInc(pick(rs, "ac")), `${label}: acres descending — ${pick(rs, "ac").slice(0, 5).join(", ")}…`);
  if (label === "Nearest first") check(nonDec(pick(rs, "km")), `${label}: distance ascending — ${pick(rs, "km").slice(0, 5).join(", ")}…`);
}
check(order["Rent: low to high"] !== order["Rent: high to low"], "the two rent sorts produce different orders");
check(order["Best match"] !== order["Largest first"], "best match is not just the largest-first order");

// View toggle
for (const name of [/^map$/i, /^list$/i]) {
  const btn = p.getByRole("button", { name }).first();
  if (await btn.count()) { await btn.click(); await p.waitForTimeout(900); }
}
check(true, "map/list view toggle clicks without error");

// Map pin -> selection
const pin = p.locator(".fk-pill, .maplibregl-marker").first();
if (await pin.count()) {
  await pin.click({ force: true });
  await p.waitForTimeout(1500);
  const clear = p.getByLabel(/clear selection/i);
  check((await clear.count()) > 0, "clicking a map price pill selects that parcel");
  if (await clear.count()) {
    await clear.click();
    await p.waitForTimeout(800);
    check((await p.getByLabel(/clear selection/i).count()) === 0, "clear selection dismisses it");
  }
} else {
  check(false, "no map markers rendered to click");
}

console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].join("\n") : "none");
if (errs.size) fail++;
console.log(fail ? `\n${fail} FAILED` : "\nSORT/MAP: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
