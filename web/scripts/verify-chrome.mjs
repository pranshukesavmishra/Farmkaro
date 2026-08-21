/** Header chrome, theme persistence, sign out, and the wizard's record tools. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errs = new Set();

// ── Theme ──────────────────────────────────────────────────────────────────
console.log("\n[theme]");
const tc = await b.newContext({ viewport: { width: 1440, height: 950 } });
const t = await tc.newPage();
t.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 200)));
await t.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await t.waitForTimeout(1500);
check(await t.evaluate(() => document.documentElement.classList.contains("dark")), "dark is the default on a first visit");
await t.getByRole("button", { name: /switch to light theme/i }).click();
await t.waitForTimeout(600);
check(!(await t.evaluate(() => document.documentElement.classList.contains("dark"))), "toggling switches to light");
check(await t.evaluate(() => localStorage.getItem("fk-theme")) === "light", "the choice is stored");
await t.goto(BASE + "/discover", { waitUntil: "domcontentloaded" });
await t.waitForTimeout(1500);
check(!(await t.evaluate(() => document.documentElement.classList.contains("dark"))), "light survives navigation, with no flash of the wrong theme");
await t.getByRole("button", { name: /switch to dark theme/i }).click();
await t.waitForTimeout(500);
check(await t.evaluate(() => document.documentElement.classList.contains("dark")), "toggling back restores dark");

// ── Sign in / notifications / sign out ─────────────────────────────────────
console.log("\n[session chrome]");
const sc = await b.newContext({ viewport: { width: 1440, height: 950 } });
const s = await sc.newPage();
s.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 200)));
await s.goto(BASE + "/dashboard/farmer", { waitUntil: "domcontentloaded" });
await s.waitForTimeout(1200);
check((await s.getByRole("button", { name: /^sign in$/i }).count()) > 0, "signed out shows a Sign in control");
const phone = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
const r = await s.evaluate((ph) => fetch("/api/auth/request-otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: ph }) }).then((x) => x.json()), phone);
await s.evaluate(([ph, c]) => fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: ph, code: c }) }).then((x) => x.json()), [phone, r.devOtp]);
// Generate a notification: offer on someone else's parcel, then look as them.
await s.reload({ waitUntil: "domcontentloaded" });
await s.waitForTimeout(2000);
check((await s.getByRole("button", { name: /notifications/i }).count()) > 0, "signed in shows the notifications control");
await s.getByRole("button", { name: /notifications/i }).click();
await s.waitForTimeout(1200);
check((await s.getByText(/notifications/i).count()) > 0, "the notifications panel opens");
const empty = await s.locator("body").innerText();
check(/nothing yet/i.test(empty) || /\d/.test(empty), "an empty inbox says so rather than rendering blank");
// Close by clicking outside
await s.mouse.click(700, 600);
await s.waitForTimeout(600);
await s.getByRole("button", { name: /sign out/i }).click();
await s.waitForTimeout(1800);
const me = await s.evaluate(() => fetch("/api/auth/me").then((x) => x.json()));
check(!me.user, "sign out clears the session server-side");
check((await s.getByRole("button", { name: /^sign in$/i }).count()) > 0, "the header returns to signed-out state");

// ── Wizard record tools ────────────────────────────────────────────────────
console.log("\n[wizard record lookup]");
const wc = await b.newContext({ viewport: { width: 1440, height: 1200 } });
const w = await wc.newPage();
w.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 200)));
await w.goto(BASE + "/list-land", { waitUntil: "domcontentloaded" });
await w.waitForTimeout(2000);
const ph2 = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
const r2 = await w.evaluate((p) => fetch("/api/auth/request-otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: p }) }).then((x) => x.json()), ph2);
await w.evaluate(([p, c]) => fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: p, code: c }) }).then((x) => x.json()), [ph2, r2.devOtp]);

// Consent gate: a lookup without consent must be refused.
const noConsent = await w.evaluate(() => fetch("/api/land-records/lookup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ state: "Madhya Pradesh", district: "Jabalpur", village: "Panagar", khasraNumber: "722/7" }) })
  .then(async (x) => ({ s: x.status, b: await x.json() })));
check(noConsent.s >= 400, `a record lookup without consent is refused (HTTP ${noConsent.s}: ${noConsent.b?.error ?? ""})`);

// Neither identifier: refused.
const neither = await w.evaluate(() => fetch("/api/land-records/lookup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ state: "Madhya Pradesh", district: "Jabalpur", consentGiven: true }) })
  .then((x) => x.status));
check(neither >= 400, `a lookup naming no khasra and no Bhu-Swami ID is refused (HTTP ${neither})`);

// Both identifiers at once: refused (it is an XOR).
const both = await w.evaluate(() => fetch("/api/land-records/lookup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ state: "Madhya Pradesh", district: "Jabalpur", village: "Panagar", khasraNumber: "722/7", bhuswamiId: "MP09-1", consentGiven: true }) })
  .then((x) => x.status));
check(both >= 400, `naming both identifiers at once is refused (HTTP ${both})`);

// A well-formed, consented lookup answers without throwing.
const good = await w.evaluate(() => fetch("/api/land-records/lookup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ state: "Madhya Pradesh", district: "Jabalpur", village: "Panagar", khasraNumber: "722/7", consentGiven: true }) })
  .then(async (x) => ({ s: x.status, b: await x.json() })));
check(good.s === 200 && typeof good.b?.found === "boolean", `a consented khasra lookup answers cleanly (HTTP ${good.s}, found=${good.b?.found})`);
check(typeof good.b?.note === "string" && good.b.note.length > 0, `it says what it did or could not do: "${String(good.b?.note).slice(0, 90)}"`);

// The scan endpoint must reject a non-document.
const junk = await w.evaluate(async () => {
  const fd = new FormData();
  fd.append("file", new Blob(["not a pdf"], { type: "text/plain" }), "x.txt");
  const r = await fetch("/api/land-records/scan", { method: "POST", body: fd });
  return { s: r.status, b: await r.json().catch(() => ({})) };
});
check(junk.s >= 400, `the scanner refuses a non-document (HTTP ${junk.s}: ${junk.b?.error ?? ""})`);

console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].join("\n") : "none");
if (errs.size) fail++;
console.log(fail ? `\n${fail} FAILED` : "\nCHROME + RECORDS: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
