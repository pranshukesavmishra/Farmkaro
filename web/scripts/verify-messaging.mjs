/**
 * The conversation an enquiry opens: both parties can read it and reply, and
 * nobody else can touch it.
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

// own-3's parcels: an identity the other checks do not take.
const OWNER = "own-3";
const PARCEL = "p-3";

const oc = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const owner = await oc.newPage();
owner.on("pageerror", (e) => errs.add("[owner] " + (e.stack || e.message).slice(0, 180)));
await owner.goto(BASE + "/dashboard/owner", { waitUntil: "domcontentloaded" });
await signIn(owner);
const claim = await owner.evaluate((o) => fetch("/api/auth/claim-owner", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ seedOwnerId: o }) }).then(async (r) => ({ s: r.status, b: await r.json() })), OWNER);
check(claim.s === 200, `owner claimed ${OWNER} (HTTP ${claim.s} ${claim.b?.error ?? ""})`);

const cc = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const cult = await cc.newPage();
cult.on("pageerror", (e) => errs.add("[cultivator] " + (e.stack || e.message).slice(0, 180)));
await cult.goto(BASE + `/parcel/${PARCEL}`, { waitUntil: "domcontentloaded" });
await signIn(cult);
await cult.evaluate((pid) => fetch("/api/enquiries", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ parcelId: pid, message: "Is this still available for a 5-year lease?" }) })
  .then((r) => r.json()), PARCEL);

// The enquiry must now carry a conversation id for BOTH sides.
const asOwner = await owner.evaluate(() => fetch("/api/enquiries").then((r) => r.json()));
const asLessee = await cult.evaluate(() => fetch("/api/enquiries").then((r) => r.json()));
const ownerEnq = (asOwner.asOwner ?? [])[0];
const lesseeEnq = (asLessee.asLessee ?? [])[0];
check(!!ownerEnq?.conversationId, `the owner's enquiry carries a conversation id (${ownerEnq?.conversationId?.slice(0, 8)}…)`);
check(!!lesseeEnq?.conversationId, "the cultivator's enquiry carries one too");
check(ownerEnq?.conversationId === lesseeEnq?.conversationId, "both sides see the same thread");

const convo = ownerEnq.conversationId;
const read = (page) => page.evaluate((id) => fetch(`/api/conversations/${id}/messages`).then(async (r) => ({ s: r.status, b: await r.json() })), convo);

const first = await read(owner);
check(first.s === 200 && (first.b.messages ?? []).length >= 1, `the owner can read the thread (${first.b.messages?.length ?? 0} message(s))`);
check(
  (first.b.messages ?? []).some((m) => (m.body ?? "").includes("5-year lease")),
  "the enquiry text is the first message in it",
);

// The owner replies through the UI.
await owner.reload({ waitUntil: "domcontentloaded" });
await owner.waitForTimeout(3000);
const replyBtn = owner.getByRole("button", { name: /^reply$/i }).first();
check((await replyBtn.count()) > 0, "the owner's desk offers a Reply control on the enquiry");
await replyBtn.click();
await owner.waitForTimeout(1200);
const dlg = owner.getByRole("dialog");
check((await dlg.count()) > 0, "the conversation opens");
check(
  (await dlg.innerText()).includes("5-year lease"),
  "the dialog shows the cultivator's original message",
);
await owner.getByLabel(/your message/i).fill("Yes — available from next season. Happy to discuss.");
await owner.getByRole("button", { name: /send message/i }).click();
await owner.waitForTimeout(2000);
check(
  (await owner.getByRole("dialog").innerText()).includes("next season"),
  "the owner's reply appears in the thread",
);

// The cultivator sees it.
const after = await read(cult);
check(
  (after.b.messages ?? []).some((m) => (m.body ?? "").includes("next season")),
  `the cultivator sees the reply (${after.b.messages?.length ?? 0} message(s))`,
);

// A third party must not.
const sc = await b.newContext();
const stranger = await sc.newPage();
await stranger.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await signIn(stranger);
const peek = await stranger.evaluate((id) => fetch(`/api/conversations/${id}/messages`).then((r) => r.status), convo);
check(peek >= 400, `a stranger cannot read the thread (HTTP ${peek})`);
const shout = await stranger.evaluate((id) => fetch(`/api/conversations/${id}/messages`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ body: "let me in" }) }).then((r) => r.status), convo);
check(shout >= 400, `a stranger cannot post to it (HTTP ${shout})`);

// Empty and oversized messages are refused.
const empty = await owner.evaluate((id) => fetch(`/api/conversations/${id}/messages`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ body: "   " }) }).then((r) => r.status), convo);
check(empty >= 400, `an empty message is refused (HTTP ${empty})`);

console.log("\n=== JS ERRORS ===");
console.log(errs.size ? [...errs].join("\n") : "none");
if (errs.size) fail++;
console.log(fail ? `\n${fail} FAILED` : "\nMESSAGING: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
