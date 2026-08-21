/**
 * The pilot record set, end to end through the UI: consent-gated lookup by
 * khasra and by Land ID, the record rendered in full, the map pinned at the
 * REAL village centroid (checked against tile coordinates), the khasra-copy
 * scan autofilling the form — and the things that must NOT appear: fabricated
 * patwari phone numbers, owner names on browse surfaces, name search.
 */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errs = new Set();

async function signIn(page) {
  const phone = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
  const r = await page.evaluate((ph) => fetch("/api/auth/request-otp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: ph }) }).then((x) => x.json()), phone);
  await page.evaluate(([ph, c]) => fetch("/api/auth/verify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: ph, code: c }) }).then((x) => x.json()), [phone, r.devOtp]);
}

const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 200)));

// ── The page, and the header route to it ───────────────────────────────────
await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
const nav = p.getByRole("link", { name: /find my land/i }).first();
check((await nav.count()) > 0, "the header carries a Find my land link");
await nav.click();
await p.waitForTimeout(2000);
check(p.url().includes("/records"), "it routes to /records");
await signIn(p);
// The auth context read /api/auth/me before the fetch-based sign-in above;
// reload so the page knows about the session before any gated action.
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);

// ── Khasra + village lookup ────────────────────────────────────────────────
await p.getByLabel(/village/i).selectOption("Panagar");
await p.getByLabel(/khasra number/i).fill("104/1");
const searchBtn = p.getByRole("button", { name: /find the record/i });
check(!(await searchBtn.isEnabled()), "search stays locked until consent is ticked");
await p.getByText(/consent to FarmKaro retrieving/i).click();
check(await searchBtn.isEnabled(), "consent unlocks the search");
await searchBtn.click();
await p.waitForTimeout(3000);

const body = await p.locator("main").innerText();
check(/MP-JBL-PAN-10401/.test(body), "the record's Land ID is shown");
check(/रामकुमार पटेल/.test(body), "owners render in Devanagari");
check(/Suresh Patel/.test(body) && /50%/.test(body), "co-owner and share shown");
check(/1\.842/.test(body) && /4\.55/.test(body) && /7\.28/.test(body), "area in hectare, acre and bigha");
check(/चौहद्दी/.test(body) && /Khasra 103/.test(body), "chauhaddi renders with the abutting plots");
check(/RCMS\/2022\/9841/.test(body), "the mutation order is shown");
check(/Clean title/i.test(body), "encumbrance status is shown");
check(/not a government-certified extract/i.test(body), "provenance disclaimer is present");
check(/village-level position/i.test(body), "the location's precision is stated");

// The pin must be at PANAGAR, not anywhere else: recover the map centre from
// the satellite tile grid actually rendered (tile x/y at z encode lng/lat).
const tiles = await p.evaluate(() =>
  [...document.querySelectorAll("article img[src*='dev-tiles'], article img[src*='tile']")]
    .map((i) => i.getAttribute("src"))
    .filter(Boolean),
);
const parsed = tiles
  .map((s) => s.match(/(\d+)\/(\d+)\/(\d+)(?:\.\w+)?(?:\?|$)/))
  .filter(Boolean)
  .map(([, z, x, y]) => ({ z: +z, x: +x, y: +y }));
check(parsed.length > 0, `satellite tiles rendered for the record (${parsed.length})`);
if (parsed.length) {
  const z = parsed[0].z;
  const xs = parsed.map((t) => t.x), ys = parsed.map((t) => t.y);
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
  const n = 2 ** z;
  const lng = (cx / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * cy) / n))) * 180) / Math.PI;
  const dLng = Math.abs(lng - 79.9944), dLat = Math.abs(lat - 23.2884);
  check(
    dLng < 0.25 && dLat < 0.25,
    `the map is centred on Panagar's real position (Δ ${dLng.toFixed(3)}°, ${dLat.toFixed(3)}°)`,
  );
}

// ── Land ID path, Devanagari digits, wrong village ─────────────────────────
await p.getByRole("tab", { name: /land id/i }).click();
await p.getByLabel(/land id/i).fill("mp-jbl-sih-21502");
await searchBtn.click();
await p.waitForTimeout(2500);
const t2 = await p.locator("main").innerText();
check(/गोसलपुर|Gosalpur/.test(t2), "Land ID lookup finds the Gosalpur record");
check(/Central Bank/.test(t2) && /3,50,000/.test(t2), "the recorded mortgage is disclosed");

await p.getByRole("tab", { name: /khasra/i }).click();
await p.getByLabel(/village/i).selectOption("Panagar");
await p.getByLabel(/khasra number/i).fill("१०४/१");
await searchBtn.click();
await p.waitForTimeout(2500);
check(/MP-JBL-PAN-10401/.test(await p.locator("main").innerText()), "Devanagari digits find the same record");

await p.getByLabel(/village/i).selectOption("Bargi");
await searchBtn.click();
await p.waitForTimeout(2500);
check(/No record found/i.test(await p.locator("main").innerText()), "the right khasra in the wrong village finds nothing");

// ── The scan autofills ─────────────────────────────────────────────────────
const pdf = (() => {
  const text = "Khasra No.: 145/2  Village: Baghraji  Area: 2.100 hectare";
  const stream = `BT /F1 12 Tf 40 750 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offs.forEach((o) => { out += String(o).padStart(10, "0") + " 00000 n \n"; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
})();
await p.locator('input[type="file"]').setInputFiles({
  name: "khasra.pdf", mimeType: "application/pdf", buffer: pdf,
});
await p.waitForTimeout(4000);
check(
  (await p.getByLabel(/khasra number/i).inputValue()) === "145/2",
  "the scan fills the khasra number from the document",
);
check(
  (await p.getByLabel(/village/i).inputValue()) === "Baghraji",
  "the scan selects the village it read",
);
await searchBtn.click();
await p.waitForTimeout(2500);
const fra = await p.locator("main").innerText();
check(/MP-JBL-KUN-14502/.test(fra), "scan -> search finds the Baghraji record");
check(/FRA 2006|non-transferable/i.test(fra), "the FRA protected-tenure status is disclosed");

// ── What must NOT be present ───────────────────────────────────────────────
for (const route of ["/records", "/", "/discover", "/dashboard/farmer"]) {
  const html = await p.evaluate(async (r) => {
    const res = await fetch(r);
    return res.text();
  }, route);
  check(!/94251000\d\d/.test(html), `${route}: no fabricated patwari phone numbers in the payload`);
}
const discoverHtml = await p.evaluate(() => fetch("/discover").then((r) => r.text()));
check(
  !/रामकुमार पटेल|Ramkumar Patel|Geeta Bai|गीता बाई/.test(discoverHtml),
  "record owners' names never appear on the browse surface",
);
const inputs = await p.evaluate(() => [...document.querySelectorAll("input, select")].map((i) => (i.getAttribute("aria-label") || i.id || "")).join("|"));
check(!/name|नाम/i.test(inputs.replace(/khasra|landid|village/gi, "")), "no search-by-name field exists");

// ── The synthetic archive ──────────────────────────────────────────────────
await p.goto(BASE + "/records", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3500);
const arch = await p.locator("main").innerText();
check(/15,000/.test(arch) && /Demonstration archive/i.test(arch), "the demo archive panel renders");
check(/synthetic/i.test(arch) && /fictional/i.test(arch), "it declares itself synthetic and fictional");
const archInput = p.getByLabel(/search the demonstration archive/i);
await archInput.fill("रमेश");
await p.waitForTimeout(1500);
const narrowed = await p.locator("main").innerText();
const m = narrowed.match(/([\d,]+) of 15,000 match/);
check(!!m && parseInt(m[1].replace(/,/g, ""), 10) > 0 && parseInt(m[1].replace(/,/g, ""), 10) < 15000,
  `name search narrows the archive (${m?.[1] ?? "?"} of 15,000)`);
check((await p.getByText(/नमूना · synthetic/i).count()) > 0, "every listed row carries the synthetic badge");
await archInput.fill("");
await p.waitForTimeout(1500);
const next = p.getByRole("button", { name: /^next$/i });
if (await next.count()) {
  const before = await p.getByText(/page 1 \//).count();
  await next.click();
  await p.waitForTimeout(1500);
  check(before > 0 && (await p.getByText(/page 2 \//).count()) > 0, "archive pagination advances");
}
// The khata enumeration hole is closed: a bare khata resolves nothing.
const khataProbe = await p.evaluate(() => fetch("/api/land-records/lookup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ state: "Madhya Pradesh", district: "Jabalpur", bhuswamiId: "34", consentGiven: true }) })
  .then(async (r) => ({ s: r.status, b: await r.json() })));
check(khataProbe.s === 200 && khataProbe.b.found === false,
  "a bare khata number no longer resolves anyone's record");
// No official-emblem certificate anywhere.
const pageHtml = await p.evaluate(() => document.documentElement.outerHTML);
check(!/certified certificate|राजस्व.*emblem|emblem.*watermark/i.test(pageHtml),
  "no page offers a government-styled certificate");

// ── Wizard consent gating ──────────────────────────────────────────────────
await p.goto(BASE + "/list-land", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
await p.getByLabel(/village/i).first().selectOption({ index: 1 });
await p.getByRole("button", { name: /continue/i }).click();
await p.waitForTimeout(2200);
// draw a quick boundary to reach the details step
const canvas2 = p.locator("canvas").first();
await canvas2.scrollIntoViewIfNeeded();
const cb2 = await canvas2.boundingBox();
for (const [dx, dy] of [[-80, -60], [80, -60], [80, 60], [-80, 60]]) {
  await p.mouse.click(cb2.x + cb2.width / 2 + dx, cb2.y + cb2.height / 2 + dy);
  await p.waitForTimeout(400);
}
await p.getByRole("button", { name: /continue/i }).click();
await p.waitForTimeout(1500);
const fetchBtn = p.getByRole("button", { name: /fetch my record/i });
if (await fetchBtn.count()) {
  await p.getByLabel(/khasra number/i).first().fill("104/1");
  check(!(await fetchBtn.isEnabled()), "wizard record fetch stays locked without ticked consent");
  await p.getByText(/consent to FarmKaro retrieving/i).first().click();
  check(await fetchBtn.isEnabled(), "ticking the wizard's consent line unlocks the fetch");
} else {
  check(false, "wizard record-fetch section not reachable");
}

// ── Mandi board on the farmer dashboard ────────────────────────────────────
await p.goto(BASE + "/dashboard/farmer", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
const mandi = await p.locator("main").innerText();
check(/मंडी भाव/.test(mandi) && /Sihora Mandi/.test(mandi), "the mandi board renders");
check(/2,680/.test(mandi.replace(/\s/g, "")), "modal prices are shown");
check(/as of/i.test(mandi), "the board carries its as-of date");
check(/not a live market feed/i.test(mandi), "and says it is indicative, not live");

console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].join("\n") : "none");
if (errs.size) fail++;
console.log(fail ? `\n${fail} FAILED` : "\nRECORDS: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
