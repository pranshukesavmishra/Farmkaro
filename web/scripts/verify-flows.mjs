/**
 * End-to-end walkthrough of the real flows, driven through the UI:
 * sign in by OTP, claim a pilot owner, run the six-step listing wizard,
 * then send an enquiry and an offer as a cultivator.
 *
 * Run against `next dev` on :3000. Fails loudly — every step asserts.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const log = (s) => console.log(s);
const ok = (s) => console.log("  ✓ " + s);
let failures = 0;
const check = (cond, msg) => {
  if (cond) ok(msg);
  else {
    failures++;
    console.log("  ✗ FAIL: " + msg);
  }
};

const phone = "9" + String(Math.floor(100000000 + Math.random() * 899999999));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
const jsErrors = [];
p.on("pageerror", (e) => jsErrors.push((e.stack || e.message).slice(0, 300)));

// ── 1. Sign in ─────────────────────────────────────────────────────────────
log("\n[1] Sign in by OTP");
await p.goto(BASE + "/dashboard/owner", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: /sign in/i }).first().click();
await p.getByLabel(/mobile number/i).fill(phone);
await p.getByRole("button", { name: /send code/i }).click();
const otpNote = await p.getByRole("dialog").getByText(/No SMS provider/i).textContent({ timeout: 10000 });
const otp = otpNote.match(/\b(\d{6})\b/)?.[1];
check(!!otp, `dev OTP surfaced (${otp})`);
await p.getByLabel(/one-time code/i).fill(otp);
await p.getByRole("button", { name: /verify/i }).click();
await p.waitForTimeout(1500);
const me = await p.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
check(me.user?.phone === phone, `session established for ${me.user?.phone}`);

// ── 2. Claim a pilot owner ─────────────────────────────────────────────────
log("\n[2] Claim a pilot owner identity");
await p.goto(BASE + "/dashboard/owner", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(800);
// Each sample identity can be held by only one account (the IDOR guard), so
// a repeat run has to take the next free one.
// One shot only: /api/auth/claim-owner is rate limited to 5/min, so a
// retry loop would be testing the limiter, not the claim.
const claimBtn = p.getByRole("button", { name: /claim parcels/i });
let claimed = null;
if (await claimBtn.count()) {
  await p.getByLabel(/sample owner/i).selectOption("own-1");
  await claimBtn.click();
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => fetch("/api/auth/me").then((x) => x.json()));
  claimed = r.user?.seedOwnerId ?? null;
}
check(
  claimed === "own-1",
  `identity linked (${claimed}) — run against a fresh data/farmkaro.db`,
);
// Holding own-1, this account must not be able to take own-2 as well, and
// must not be able to claim an id outside the sample set.
const second = await p.evaluate(() =>
  fetch("/api/auth/claim-owner", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seedOwnerId: "own-2" }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })),
);
check(
  second.status >= 400,
  `an account holding own-1 cannot also take own-2 (HTTP ${second.status}: ${second.body?.error ?? ""})`,
);
const junk = await p.evaluate(() =>
  fetch("/api/auth/claim-owner", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seedOwnerId: "own-99999" }),
  }).then((r) => r.status),
);
check(junk >= 400, `an out-of-range identity is rejected (HTTP ${junk})`);
const stillOwn1 = await p.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
check(stillOwn1.user?.seedOwnerId === "own-1", "the original identity survives the attempts");
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
check(
  (await p.getByRole("heading", { name: /your parcels/i }).count()) > 0,
  "owner dashboard renders the claimed holdings",
);

// ── 3. The listing wizard, all six steps ───────────────────────────────────
log("\n[3] List a parcel through the wizard");
await p.goto(BASE + "/list-land", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);

const stepHeading = async () =>
  (await p.locator("h2, h1").filter({ hasText: /./ }).first().textContent())?.trim();

// Step 01 — Locate
await p.getByLabel(/village/i).first().selectOption({ index: 1 });
ok("step 01: village selected — " + (await stepHeading()));
const cont = p.getByRole("button", { name: /continue/i });
check(await cont.isEnabled(), "Continue unlocks once the required field is filled");
await cont.click();
await p.waitForTimeout(2500);

// Step 02 — Boundary (map). Confirm whatever affordance it offers.
log("  step 02: " + (await stepHeading()));
await p.screenshot({ path: "/tmp/flow-step2.png" });
// The boundary step wants a drawn polygon: tap each corner of the field.
const canvas = p.locator("canvas").first();
check((await canvas.count()) > 0, "step 02: the draw map mounted");
await canvas.scrollIntoViewIfNeeded();
await p.waitForTimeout(800);
const box = await canvas.boundingBox();
const corners = [
  [-90, -70],
  [90, -70],
  [90, 70],
  [-90, 70],
];
for (const [dx, dy] of corners) {
  await p.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
  await p.waitForTimeout(500);
}
await p.screenshot({ path: "/tmp/flow-step2-drawn.png" });
const mapChrome = (await p.locator("main").innerText()).replace(/\n+/g, " | ");
check(
  /\d+\s*(points?|corners?)|\d+(\.\d+)?\s*ac/i.test(mapChrome),
  `step 02: the draw map reports state — "${mapChrome.slice(0, 200)}"`,
);
check(await cont.isEnabled(), "step 02: boundary/point captured, Continue enabled");
await cont.click();
await p.waitForTimeout(1200);

// Steps 03-06 — fill every visible required control, then continue.
for (let step = 3; step <= 6; step++) {
  const title = await stepHeading();
  log(`  step 0${step}: ${title}`);
  for (const el of await p.locator("main input:visible, main select:visible, main textarea:visible").all()) {
    const tag = await el.evaluate((n) => n.tagName);
    const type = await el.evaluate((n) => n.type || "");
    if (type === "file" || type === "checkbox" || type === "radio") continue;
    const val = await el.inputValue().catch(() => "x");
    if (val) continue;
    if (tag === "SELECT") {
      const n = await el.locator("option").count();
      if (n > 1) await el.selectOption({ index: 1 });
    } else if (type === "number") {
      await el.fill("12000");
    } else {
      await el.fill("Verification pass — automated walkthrough.");
    }
  }
  await p.waitForTimeout(400);
  const next = p.getByRole("button", { name: /continue|review & send|publish|submit|finish/i }).first();
  // Toggle-button groups (water sources, electricity, road) aren't inputs.
  // Press one option in each group that has nothing selected yet.
  for (const group of await p.locator("main fieldset").all()) {
    if (await next.isEnabled()) break;
    if ((await group.locator('[aria-pressed="true"]').count()) > 0) continue;
    const opt = group.locator('[aria-pressed="false"]').first();
    if (await opt.count()) {
      await opt.click();
      await p.waitForTimeout(350);
    }
  }
  check(await next.isEnabled(), `step 0${step}: advance control enabled`);
  await next.click();
  await p.waitForTimeout(1800);
}
await p.screenshot({ path: "/tmp/flow-wizard-end.png", fullPage: true });
// The pilot hands off to a field executive rather than self-publishing, so
// the wizard ends on a review screen carrying everything the owner entered.
check(
  (await p.getByRole("heading", { name: /ready for the lease desk/i }).count()) > 0,
  "wizard reaches the intake-complete review screen",
);
const summary = await p.locator("main").innerText();
check(/Corners drawn/i.test(summary), "review screen lists the drawn corners");
check(/\d+(\.\d+)?\s*ac/i.test(summary), "review screen carries a computed area");
check(
  (await p.getByRole("link", { name: /download boundary/i }).count()) > 0,
  "the drawn boundary is exportable as GeoJSON",
);
const geo = await p
  .getByRole("link", { name: /download boundary/i })
  .getAttribute("href");
const parsed = JSON.parse(decodeURIComponent(geo.split(",").slice(1).join(",")));
check(
  parsed.geometry?.type === "Polygon" && parsed.geometry.coordinates[0].length >= 4,
  `exported GeoJSON is a closed polygon (${parsed.geometry?.coordinates?.[0]?.length} vertices)`,
);

// ── 4. The owner cannot bid on their own land ──────────────────────────────
log("\n[4] The owner cannot enquire on their own parcel");
await p.goto(BASE + "/parcel/p-1", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
const ownParcel = await p.evaluate(() =>
  fetch("/api/enquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parcelId: "p-1", message: "Testing the self-deal guard." }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })),
);
check(
  ownParcel.status >= 400,
  `own-1 is refused on their own parcel p-1 (HTTP ${ownParcel.status}: ${ownParcel.body?.error ?? ""})`,
);

// ── 5. A cultivator enquires and offers, and it reaches the owner ──────────
log("\n[5] A second account enquires and offers");
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 950 } });
const q = await ctx2.newPage();
q.on("pageerror", (e) => jsErrors.push("[cultivator] " + (e.stack || e.message).slice(0, 300)));
const phone2 = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
await q.goto(BASE + "/parcel/p-1", { waitUntil: "domcontentloaded" });
await q.waitForTimeout(1200);
await q.getByRole("button", { name: /send enquiry/i }).click();
await q.waitForTimeout(800);
await q.getByLabel(/mobile number/i).fill(phone2);
await q.getByRole("button", { name: /send code/i }).click();
const note2 = await q.getByRole("dialog").getByText(/No SMS provider/i).textContent({ timeout: 10000 });
await q.getByLabel(/one-time code/i).fill(note2.match(/\b(\d{6})\b/)[1]);
await q.getByRole("button", { name: /verify/i }).click();
await q.waitForTimeout(1800);
check(
  (await q.evaluate(() => fetch("/api/auth/me").then((r) => r.json()))).user?.phone === phone2,
  "the enquiry button gated an anonymous visitor into sign-in, and it completed",
);

await q.getByRole("button", { name: /send enquiry/i }).click();
await q.waitForTimeout(700);
await q.getByRole("dialog").getByRole("button", { name: /send enquiry/i }).click();
await q.waitForTimeout(1800);
check(
  (await q.getByText(/Enquiry sent to the owner/i).count()) > 0,
  "enquiry accepted and confirmed in the UI",
);

await q.getByRole("button", { name: /make an offer/i }).click();
await q.waitForTimeout(700);
await q.getByLabel(/rent/i).first().fill("240000");
await q.getByLabel(/lease term/i).selectOption("5");
await q.getByRole("dialog").getByRole("button", { name: /send offer/i }).click();
await q.waitForTimeout(1800);
check((await q.getByText(/Offer sent to the owner/i).count()) > 0, "offer accepted and confirmed");

// ── 6. It reached the owner ────────────────────────────────────────────────
log("\n[6] The owner is notified");
const notifs = await p.evaluate(() => fetch("/api/notifications").then((r) => r.json()));
const titles = (notifs.notifications ?? []).map((n) => n.title).join(" | ");
check(
  (notifs.notifications ?? []).length >= 2,
  `owner has ${notifs.notifications?.length ?? 0} notification(s): ${titles.slice(0, 120)}`,
);
await p.goto(BASE + "/dashboard/owner", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
const dash = await p.locator("main").innerText();
check(/2,40,000|240000/.test(dash.replace(/\s/g, "")), "the offer amount appears on the owner dashboard");
await p.screenshot({ path: "/tmp/flow-owner-inbox.png", fullPage: true });

// The cultivator must not be able to read the owner's dashboard data.
const idor = await q.evaluate(() =>
  fetch("/api/notifications").then((r) => r.json()).catch(() => ({})),
);
const leaked = (idor.notifications ?? []).some((n) => /offer|enquiry/i.test(n.title ?? "") && /received/i.test(n.title ?? ""));
check(!leaked, "the cultivator does not see the owner's inbound notifications");

log("\n" + "─".repeat(60));
check(jsErrors.length === 0, `no uncaught JS errors (${jsErrors.length})`);
if (jsErrors.length) console.log([...new Set(jsErrors)].slice(0, 5).join("\n"));
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
await b.close();
process.exit(failures ? 1 : 0);
