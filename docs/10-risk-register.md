# 10 — Risk Register

*Ranked by expected damage. Each risk has an owner-facing mitigation, not a platitude.*

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **The state's leasing law is not usable in practice** — enacted but not notified, or the tehsil/sub-registrar simply doesn't process agricultural leases this way | Medium | **Fatal** | Week-1 advocate note + physical sub-registrar visit *before* anything is built (§08 #1, #3). If MP is unworkable, the same playbook moves to Maharashtra, where the framework is reported operational from 8 May 2026 |
| **R2** | **Landowners refuse to formalise** regardless of the law — fear is cultural, not just legal | Medium-High | High | Lead with the *end-date* guarantee and `creates_tenancy_rights = false` in plain Hindi; start with owners who already lease informally (they've accepted a cultivator, just not a document); use the first 3 registered leases as social proof in the same villages |
| **R3** | **Disintermediation** — parties meet through FarmKaro then transact privately | High | High | Charge for the *service* (documentation, registration, verification), not the introduction (§4.5). The advocate, stamping and sub-registrar coordination cannot be bypassed by exchanging phone numbers |
| **R4** | **Founder repeats the v1 pattern** — competitions, decks, features, no leases | **High** | **Fatal** | Phase gates are numeric, not date-based (§05). The quarterly rule: no phase advances until its gate number is met. Explicit ban on competitions in the first 180 days (§08) |
| **R5** | **Regulatory** — a product surface is read as CIS or as unlicensed payment handling | Low-Medium | **Fatal** | Hard stops in §2.5 and §3.6. No pooled investment, no fractional ownership, no assured returns, no holding funds. Licensed PA only. Annual counsel review |
| **R6** | **Title/fraud incident** — FarmKaro facilitates a lease on land the "owner" doesn't own | Medium | **Severe (brand-ending)** | Verification ladder is mandatory before any lease (§5.5); physical field visit; record extract; encumbrance observation; explicit written disclaimer of what FarmKaro did and did not check; professional indemnity insurance from month 6 |
| **R7** | **Dispute during a live lease** (crop damage, non-payment, early termination) | High over time | Medium | Document everything in `lease_events`; standard termination and dispute clauses drafted up front; a named mediation path; never position FarmKaro as a party or a guarantor |
| **R8** | **Seasonality** — two leasing windows/year means long dry spells | Certain | Medium | Sell Verification Packs and institutional mandates counter-cyclically; use off-season for supply build-up and content |
| **R9** | **Ops doesn't scale** — every lease needs a founder | High | Medium | Village-level Land Mitras on commission (§08 #25); productise the dossier; measure hours-per-lease as a tracked metric from lease #1 |
| **R10** | **Cash-out before proof** | Medium | Fatal | ₹8–15L bootstrap sized for 12 months at ₹1.04L/month; pursue non-dilutive grants (RKVY-RAFTAAR, NABARD, MP Startup Policy) in parallel; do not hire ahead of revenue |
| **R11** | **A funded competitor copies the model** | Low near-term | Medium | The moat is the Parcel Graph + local trust operation, not the UI (§3.5). Depth in one district beats breadth |
| **R12** | **Data/privacy incident** — leaked land documents | Low | High | Private buckets, ≤5-min signed URLs, resource-level policy with an explicit IDOR test, audit log, DPDP-aligned consent and retention (§6.6) |
| **R13** | **Google Maps cost blowout** at scale | Medium | Low-Medium | MapLibre for vector polygon rendering; Google only for satellite tiles, geocoding, distance matrix; aggressive Redis caching; monitored quota alerts |
| **R14** | **Co-founder misalignment** on the new, slower, less glamorous plan | Medium | High | Agree §09's kill criteria **in writing before starting**; explicit role split (one owns field/legal, one owns product/eng); monthly written check-in against the metric tree |
| **R15** | **AI features shipped on invented data** — the failure the master prompt warns against | Medium | High | Schema-level enforcement: `ai_price_estimates` requires `comparable_count > 0`; `ai_recommendations` requires a non-empty breakdown; `verification_records.is_government_verification` is `CHECK`-constrained to false (§07) |

## The two that actually decide the outcome

**R1** and **R4.**

R1 is answered in week 1, for the price of an advocate's time. Answer it before anything else — the entire strategy is downstream of that one note.

R4 is answered every single week, forever, by whether the founders can tolerate a plan whose first six months produce no demo, no launch, no trophy, and no announcement — only three signed leases and a spreadsheet of what went wrong.

That trade — trophies for leases — is the whole relaunch.
