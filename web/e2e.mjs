import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errs = [];
const shots = [];
async function page(ctx) {
  const p = await ctx.newPage({ viewport: { width: 1440, height: 950 } });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));
  return p;
}
const step = (m) => console.log("STEP: " + m);

// ---------- Cultivator session ----------
const farmerCtx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const fp = await farmerCtx.newPage();
fp.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));

step("open parcel p-8");
await fp.goto("http://localhost:3000/parcel/p-8", { waitUntil: "domcontentloaded" });
await fp.waitForTimeout(2500);

step("click Send enquiry -> login dialog");
await fp.click("text=Send enquiry");
await fp.waitForSelector("#login-phone", { timeout: 8000 });
await fp.fill("#login-phone", "9811122233");
await fp.click("text=Send code");
await fp.waitForSelector("#login-code", { timeout: 8000 });
const otpText = await fp.locator("text=your code is").textContent();
const otp = otpText.match(/(\d{6})/)[1];
step("got dev OTP " + otp);
await fp.fill("#login-code", otp);
await fp.screenshot({ path: "/tmp/e2e-1-login.png" });
await fp.click("[role='dialog'] button[type='submit']");
await fp.waitForTimeout(1500);

step("send enquiry as signed-in user");
await fp.click("text=Send enquiry");
await fp.waitForSelector("#enq-msg", { timeout: 8000 });
await fp.click("[role='dialog'] button[type='submit']");
await fp.waitForSelector("text=Enquiry sent", { timeout: 8000 });
step("enquiry confirmed");

step("make an offer");
await fp.click("text=Make an offer");
await fp.waitForSelector("#offer-rent", { timeout: 8000 });
await fp.fill("#offer-rent", "48000");
await fp.selectOption("#offer-years", "3");
await fp.fill("#offer-note", "Ready to start this rabi season");
await fp.screenshot({ path: "/tmp/e2e-2-offer.png" });
await fp.click("[role='dialog'] button[type='submit']");
await fp.waitForSelector("text=Offer sent", { timeout: 8000 });
step("offer confirmed");

// which seed owner owns p-8?
const seedOwner = await fp.evaluate(async () => {
  const r = await fetch("/api/parcels/p-8/geojson");
  return r.ok ? "geojson-ok" : "geojson-fail";
});
step("geojson endpoint: " + seedOwner);

// ---------- Owner session (separate context = separate cookies) ----------
const ownerCtx = await b.newContext({ viewport: { width: 1440, height: 950 } });
const op = await ownerCtx.newPage();
op.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));

step("owner: open owner dashboard and sign in");
await op.goto("http://localhost:3000/dashboard/owner", { waitUntil: "domcontentloaded" });
await op.waitForTimeout(1500);
await op.click("text=Sign in to try it");
await op.waitForSelector("#login-phone", { timeout: 8000 });
await op.fill("#login-phone", "9822233445");
await op.click("text=Send code");
await op.waitForSelector("#login-code", { timeout: 8000 });
const otp2 = (await op.locator("text=your code is").textContent()).match(/(\d{6})/)[1];
await op.fill("#login-code", otp2);
await op.click("[role='dialog'] button[type='submit']");
await op.waitForTimeout(1500);

step("owner: claim the sample owner that owns p-8 (own-8 per seed: p-8 -> owners[(8-1)%15]=own-8)");
await op.selectOption("select[aria-label='Sample owner']", "own-8");
await op.click("text=Claim parcels");
await op.waitForTimeout(1800);

step("owner: reload dashboard, expect live activity with the offer");
await op.reload({ waitUntil: "domcontentloaded" });
await op.waitForSelector("text=Your live activity", { timeout: 10000 });
await op.waitForSelector("text=Accept", { timeout: 10000 });
await op.screenshot({ path: "/tmp/e2e-3-owner-inbox.png" });

step("owner: accept the offer");
await op.click("button:has-text('Accept')");
await op.waitForSelector("text=Leases", { timeout: 10000 });
step("draft lease visible");

step("owner: advance lease draft->terms_agreed->agreement_generated->signed->active");
for (const label of ["Agree terms", "Generate agreement", "Mark signed", "Activate lease"]) {
  await op.click(`button:has-text('${label}')`);
  await op.waitForTimeout(1200);
}
step("owner: move registration forward once (-> Stamped)");
await op.click("button:has-text('Registration')");
await op.waitForTimeout(1200);
await op.screenshot({ path: "/tmp/e2e-4-owner-lease-active.png" });

// ---------- Cultivator sees the active lease + notifications ----------
step("cultivator: farmer dashboard shows the active lease");
await fp.goto("http://localhost:3000/dashboard/farmer", { waitUntil: "domcontentloaded" });
await fp.waitForSelector("text=Your live activity", { timeout: 10000 });
await fp.waitForSelector("text=active", { timeout: 10000 });
await fp.screenshot({ path: "/tmp/e2e-5-farmer-lease.png" });

step("cultivator: notification bell shows unread");
const bell = await fp.locator("[aria-label*='Notifications']").getAttribute("aria-label");
step("bell: " + bell);

console.log(errs.length ? "ERRORS:\n" + [...new Set(errs)].join("\n") : "NO PAGE ERRORS");
console.log("E2E COMPLETE");
await b.close();
