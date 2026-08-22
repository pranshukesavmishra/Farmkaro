/**
 * Concurrency probe: fire genuinely parallel HTTP requests at the
 * check-then-act sequences and assert exactly-once semantics. better-sqlite3
 * is synchronous, which SHOULD serialize each handler's critical section —
 * this proves it from outside instead of assuming it.
 */
const BASE = "http://localhost:3000";
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A signed-in fetch context. OTP requests are rate limited to 5/min per IP,
 * and this probe drives many accounts from one host, so request-otp retries
 * with backoff — the limit is correct behaviour, not the thing under test.
 */
async function session() {
  const phone = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
  let cookie = "";
  const collect = (res) => {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) cookie = cookie ? `${cookie}; ${c.split(";")[0]}` : c.split(";")[0];
  };
  const post = async (path, body) => {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    collect(res);
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const get = async (path) => {
    const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {} });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  let r1;
  for (let i = 0; i < 15; i++) {
    r1 = await post("/api/auth/request-otp", { phone });
    if (r1.status === 200) break;
    if (r1.status === 429) { await sleep(13000); continue; }
    throw new Error(`request-otp failed: ${r1.status}`);
  }
  const v = await post("/api/auth/verify", { phone, code: r1.body.devOtp });
  if (v.status !== 200) throw new Error(`verify failed: ${v.status}`);
  return { post, get, phone };
}

// ── 1. Two accounts race to claim the same sample identity ─────────────────
console.log("\n[1] Parallel identity claims");
{
  const [a, b] = await Promise.all([session(), session()]);
  const [ra, rb] = await Promise.all([
    a.post("/api/auth/claim-owner", { seedOwnerId: "own-5" }),
    b.post("/api/auth/claim-owner", { seedOwnerId: "own-5" }),
  ]);
  const wins = [ra, rb].filter((r) => r.status === 200).length;
  check(wins === 1, `exactly one of two simultaneous claims wins (${ra.status}/${rb.status})`);
}

// ── 2. Owner double-accepts the same offer in parallel ─────────────────────
console.log("\n[2] Double-accept of one offer");
{
  const owner = await session();
  await owner.post("/api/auth/claim-owner", { seedOwnerId: "own-6" });
  const farmer = await session();
  await farmer.post("/api/offers", { parcelId: "p-6", rentAnnual: 150000, leaseYears: 3 });
  const offers = await owner.get("/api/offers");
  const offer = (offers.body.offers ?? []).find((o) => o.status === "open");
  check(!!offer, "the offer reached the owner's desk");
  const [r1, r2] = await Promise.all([
    owner.post(`/api/offers/${offer.id}/respond`, { action: "accept" }),
    owner.post(`/api/offers/${offer.id}/respond`, { action: "accept" }),
  ]);
  const ok = [r1, r2].filter((r) => r.status < 400).length;
  check(ok === 1, `exactly one accept succeeds (${r1.status}/${r2.status})`);
  const leases = await owner.get("/api/leases");
  const drafts = (leases.body.leases ?? []).filter((l) => l.parcelId === "p-6");
  check(drafts.length === 1, `exactly one lease was drafted (${drafts.length})`);
}

// ── 3. Two farmers' offers on one parcel; owner accepts both in parallel ───
console.log("\n[3] Parallel accepts of two offers on one parcel");
{
  const owner = await session();
  await owner.post("/api/auth/claim-owner", { seedOwnerId: "own-7" });
  const [f1, f2] = await Promise.all([session(), session()]);
  await Promise.all([
    f1.post("/api/offers", { parcelId: "p-7", rentAnnual: 120000, leaseYears: 3 }),
    f2.post("/api/offers", { parcelId: "p-7", rentAnnual: 130000, leaseYears: 5 }),
  ]);
  const offers = await owner.get("/api/offers");
  const open = (offers.body.offers ?? []).filter((o) => o.status === "open" && o.parcelId === "p-7");
  check(open.length === 2, `both offers landed (${open.length})`);
  const [r1, r2] = await Promise.all(
    open.map((o) => owner.post(`/api/offers/${o.id}/respond`, { action: "accept" })),
  );
  const ok = [r1, r2].filter((r) => r.status < 400).length;
  check(ok === 1, `only one offer can become a live lease (${r1.status}/${r2.status})`);
  const leases = await owner.get("/api/leases");
  const live = (leases.body.leases ?? []).filter((l) => l.parcelId === "p-7");
  check(live.length === 1, `one live lease on the parcel (${live.length})`);
}

// ── 4. Double lease-advance in parallel ────────────────────────────────────
console.log("\n[4] Double lease transition");
{
  const owner = await session();
  await owner.post("/api/auth/claim-owner", { seedOwnerId: "own-8" });
  const farmer = await session();
  await farmer.post("/api/offers", { parcelId: "p-8", rentAnnual: 110000, leaseYears: 3 });
  const offers = await owner.get("/api/offers");
  const offer = (offers.body.offers ?? []).find((o) => o.status === "open" && o.parcelId === "p-8");
  await owner.post(`/api/offers/${offer.id}/respond`, { action: "accept" });
  const leases = await owner.get("/api/leases");
  const lease = (leases.body.leases ?? []).find((l) => l.parcelId === "p-8");
  const [r1, r2] = await Promise.all([
    owner.post(`/api/leases/${lease.id}/advance`, { to: "terms_agreed" }),
    owner.post(`/api/leases/${lease.id}/advance`, { to: "terms_agreed" }),
  ]);
  const ok = [r1, r2].filter((r) => r.status < 400).length;
  check(ok === 1, `exactly one transition applies (${r1.status}/${r2.status})`);

  // Race to "active" twice: the payment schedule must not duplicate.
  for (const to of ["agreement_generated", "signed"]) {
    await owner.post(`/api/leases/${lease.id}/advance`, { to });
  }
  const [a1, a2] = await Promise.all([
    owner.post(`/api/leases/${lease.id}/advance`, { to: "active" }),
    owner.post(`/api/leases/${lease.id}/advance`, { to: "active" }),
  ]);
  const okA = [a1, a2].filter((r) => r.status < 400).length;
  check(okA === 1, `activation applies once (${a1.status}/${a2.status})`);
  const after = await owner.get("/api/leases");
  const L = (after.body.leases ?? []).find((l) => l.id === lease.id);
  check(L.status === "active", `lease is active (${L.status})`);
}

// ── 5. OTP replay ──────────────────────────────────────────────────────────
console.log("\n[5] OTP replay");
{
  const phone = "9" + String(Math.floor(100000000 + Math.random() * 899999999));
  let req;
  for (let i = 0; i < 15; i++) {
    const r = await fetch(BASE + "/api/auth/request-otp", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (r.status === 200) { req = await r.json(); break; }
    if (r.status === 429) { await sleep(13000); continue; }
    throw new Error(`request-otp failed: ${r.status}`);
  }
  const verify = () => fetch(BASE + "/api/auth/verify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, code: req.devOtp }),
  }).then((r) => r.status);
  const first = await verify();
  const second = await verify();
  check(first === 200 && second >= 400, `a code verifies once and only once (${first}, then ${second})`);
}

console.log(fail ? `\n${fail} FAILED` : "\nCONCURRENCY: ALL PASSED");
process.exit(fail ? 1 : 0);
