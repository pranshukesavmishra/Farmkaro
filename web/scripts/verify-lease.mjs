/**
 * The full deal lifecycle through the UI: three cultivator offers on one
 * owner's parcels, then accept / counter / reject, then drive the resulting
 * lease through every state transition and registration step.
 */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errs = new Set();

async function signIn(page) {
  const phone = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
  const r1 = await page.evaluate((ph) => fetch("/api/auth/request-otp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: ph }) }).then((r) => r.json()), phone);
  await page.evaluate(([ph, code]) => fetch("/api/auth/verify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: ph, code }) }).then((r) => r.json()), [phone, r1.devOtp]);
  return phone;
}

// ── Owner ──────────────────────────────────────────────────────────────────
const oc = await b.newContext({ viewport: { width: 1440, height: 1400 } });
const owner = await oc.newPage();
owner.on("pageerror", (e) => errs.add("[owner] " + (e.stack || e.message).slice(0, 200)));
await owner.goto(BASE + "/dashboard/owner", { waitUntil: "domcontentloaded" });
await signIn(owner);
// own-2, not own-1: each sample identity can be claimed once, and
// verify-flows takes own-1 when the whole suite runs against one database.
const claim = await owner.evaluate(() => fetch("/api/auth/claim-owner", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ seedOwnerId: "own-2" }) }).then(async (r) => ({ s: r.status, b: await r.json() })));
check(claim.s === 200, `owner claimed own-2 (HTTP ${claim.s} ${claim.b?.error ?? ""})`);

const parcels = await owner.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
check(!!parcels.user?.seedOwnerId, "owner session carries the seed identity");

// ── Cultivator makes three offers ──────────────────────────────────────────
const cc = await b.newContext({ viewport: { width: 1440, height: 950 } });
const cult = await cc.newPage();
cult.on("pageerror", (e) => errs.add("[cultivator] " + (e.stack || e.message).slice(0, 200)));
await cult.goto(BASE + "/parcel/p-1", { waitUntil: "domcontentloaded" });
await signIn(cult);
// own-2's actual holdings — an offer on anyone else's parcel goes to
// their desk, not this owner's.
const targets = ["p-2", "p-17", "p-32"];
const offerIds = [];
for (const t of targets) {
  const r = await cult.evaluate((pid) => fetch("/api/offers", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ parcelId: pid, rentAnnual: 195000, leaseYears: 4 }) })
    .then(async (x) => ({ s: x.status, b: await x.json() })), t);
  offerIds.push(r.b?.offer?.id ?? r.b?.id ?? null);
  check(r.s < 400, `offer on ${t} accepted (HTTP ${r.s})`);
}

// ── Owner responds ─────────────────────────────────────────────────────────
await owner.reload({ waitUntil: "domcontentloaded" });
await owner.waitForTimeout(3000);
const offerRows = owner.locator("li").filter({ has: owner.getByRole("button", { name: /accept/i }) });
const n = await offerRows.count();
check(n >= 3, `owner's desk lists ${n} actionable offers`);

// Reject the last
await offerRows.last().getByRole("button", { name: /reject/i }).click();
await owner.waitForTimeout(2500);
check(await offerRows.count() < n, `reject removes it from the actionable list (${n} -> ${await offerRows.count()})`);

// Counter the (now) last — handled via whatever prompt mechanism exists
owner.once("dialog", (d) => d.accept("205000"));
const counterBtn = offerRows.last().getByRole("button", { name: /counter/i });
await counterBtn.click();
await owner.waitForTimeout(1200);
// A styled dialog may have opened instead of window.prompt
const modal = owner.getByRole("dialog");
if (await modal.count()) {
  const rentField = modal.getByLabel(/rent/i).first();
  if (await rentField.count()) await rentField.fill("205000");
  await modal.getByRole("button", { name: /send|counter|submit/i }).first().click();
}
await owner.waitForTimeout(2500);
const afterCounter = await owner.locator("main").innerText();
check(/2,05,000|205000/.test(afterCounter.replace(/\s/g, "")), "the countered amount is reflected on the desk");

// Accept the first -> draft lease
await owner.reload({ waitUntil: "domcontentloaded" });
await owner.waitForTimeout(3000);
const acceptBtn = owner.getByRole("button", { name: /accept/i }).first();
check((await acceptBtn.count()) > 0, "an offer remains open to accept");
await acceptBtn.click();
await owner.waitForTimeout(3000);
const leases = await owner.evaluate(() => fetch("/api/leases").then((r) => r.json()));
const drafts = (leases.leases ?? []).filter((l) => l.status === "draft");
check(drafts.length >= 1, `accepting an offer drafts a lease (${drafts.length} draft(s))`);

// ── Drive the lease through every transition ───────────────────────────────
let lease = drafts[0];
const seen = [lease?.status];
for (let i = 0; i < 6 && lease; i++) {
  const next = (lease.nextTransitions ?? []).filter((t) => t !== "terminated")[0];
  if (!next) break;
  const r = await owner.evaluate(([id, to]) => fetch(`/api/leases/${id}/advance`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ to }) }).then(async (x) => ({ s: x.status, b: await x.json() })), [lease.id, next]);
  check(r.s < 400, `lease ${lease.status} → ${next} (HTTP ${r.s} ${r.b?.error ?? ""})`);
  const all = await owner.evaluate(() => fetch("/api/leases").then((r) => r.json()));
  lease = (all.leases ?? []).find((l) => l.id === lease.id);
  seen.push(lease?.status);
}
check(seen.length >= 3, `lease walked its states: ${seen.join(" → ")}`);

// Registration ladder
const regs = ["stamped", "submitted_for_registration", "registered"];
for (const to of regs) {
  const r = await owner.evaluate(([id, t]) => fetch(`/api/leases/${id}/registration`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: t }) }).then(async (x) => ({ s: x.status, b: await x.json() })), [lease.id, to]);
  check(r.s < 400, `registration → ${to} (HTTP ${r.s} ${r.b?.error ?? ""})`);
}

// An invalid jump must be refused.
const bogus = await owner.evaluate((id) => fetch(`/api/leases/${id}/advance`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ to: "draft" }) }).then((x) => x.status), lease.id);
check(bogus >= 400, `an illegal backwards transition is refused (HTTP ${bogus})`);

// The cultivator must not be able to drive the owner's lease.
const hijack = await cult.evaluate((id) => fetch(`/api/leases/${id}/registration`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ to: "registered" }) }).then((x) => x.status), lease.id);
check(hijack >= 400, `the cultivator cannot change the lease's registration (HTTP ${hijack})`);

console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].join("\n") : "none");
if (errs.size) fail++;
console.log(fail ? `\n${fail} FAILED` : "\nLEASE LIFECYCLE: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
