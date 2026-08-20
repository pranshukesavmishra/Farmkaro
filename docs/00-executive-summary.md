# FarmKaro v2 — Relaunch Plan

**Prepared for:** Pranshu Mishra & Aryan Singh, FarmKaro (farmkaro.in), Jabalpur, Madhya Pradesh
**Inputs analysed:** FK investor deck (14 slides) · live farmkaro.in · v2 master build prompt · primary legal/market research (sourced in §02)
**Date:** August 2026

---

## The diagnosis, in one sentence

> **v1 built a marketplace interface for a problem whose bottleneck is legal risk, in a market whose liquidity is district-level, funded by a revenue model its customers could not afford, and measured itself against competition judges instead of executed leases.**

The problem FarmKaro chose is real. The name is good. The design ambition is right. **The order of operations was wrong, and the customer who pays was misidentified.**

## The five decisions that define v2

**1. FarmKaro is a lease-execution service, not a listings marketplace.**
The reason 87% of Indian farmland is not formally leased is not that landowners couldn't find a website. It is that recording a tenant has historically threatened the owner's title. Matching was never the bottleneck. **Safe, reversible, provable, registered leasing is.** Model the company on a title-and-escrow firm with excellent software — not on Airbnb.

**2. Charge the institution, serve the smallholder.**
v1 aimed its monetisation at 2-acre farmers via ₹500/month subscriptions and 10% crop commissions. Neither exists. The buyers with budget are **FPOs, seed companies, orchard and agroforestry developers, processors, nurseries, and agri-entrepreneurs scaling past their own land**. They pay ₹18k–₹65k per lease and come back every season. Landowners pay nothing.

**3. One district, saturated — Jabalpur first.**
Land is hyper-local, seasonal and illiquid. A national map is a dead map. Own 15–25 villages completely: who owns what, what's idle, what rent clears, which patwari serves which halka. That local data monopoly cannot be copied by a competitor with a better designer.

**4. Operator-led before software-led.**
**Phase 0 has no platform.** A WhatsApp number, a Hindi form, a spreadsheet, a phone GPS, an advocate on retainer, and a target of **three executed leases**. Those three leases are the product specification. Only then does engineering start — on the parcel dossier, not the marketplace.

**5. Honesty is the moat, and it is enforced in the schema.**
No fabricated verification, no invented government approval, no fake reviews, no "escrow" before escrow exists, no AI price estimate without comparables behind it. In §07 this is not a guideline — `verification_records` carries a `CHECK` constraint making a false government-verification claim a database error, and `ai_price_estimates` cannot store an estimate with zero evidence.

## What the research changed

Two things are true now that were not when v1 was pitched, and both are load-bearing:

- **The legal window opened.** Madhya Pradesh has enacted a separate land-leasing law on the NITI model; UP and Uttarakhand amended theirs; **Maharashtra's Act had rules notified 2 June 2025 with the framework reported operational from 8 May 2026.** These statutes share the one sentence a landowner needs: *a lease under the Act does not create protected tenancy, and possession reverts on expiry.* **[VERIFY LOCALLY]**
- **The national data substrate arrived.** **ULPIN/Bhu-Aadhaar** gives every parcel a 14-digit ID derived from its coordinates; **AgriStack's Farmer Registry** gives every farmer an 11-digit ID linked to land records. Two nullable columns in the schema today make FarmKaro joinable to all of it tomorrow.

And one thing to walk away from: **SEBI's January 2024 interim order against Growpital** established that pooled agri-investment dressed as "fractional ownership" is an unregistered Collective Investment Scheme. v1's deck was drifting toward exactly this with "Landowner Partnerships — land leasing + revenue sharing" for "investors." Hard stop.

## The numbers, honestly

Replacing the deck's "$13.8 Trillion global market":

| | |
|---|---|
| Contribution margin, retail lease (~4 acres) | **₹11,900 (66%)** |
| Contribution margin, institutional lease (~30 acres) | **₹47,400 (72%)** |
| Monthly fixed cost, lean Jabalpur setup | **₹1.04 lakh** |
| **Break-even** | **≈ 9 retail leases/month**, or 2 institutional + 3 retail |
| Revenue ceiling per saturated district | **~₹60 lakh/year** |
| Funding ask | **₹8–15L bootstrap now**; ₹75L–1.5Cr pre-seed at month 9–15 **on 30–50 executed leases** — not ₹10 Cr on zero |

*All figures are labelled assumptions to be replaced with observed data after the first ten leases. Saying so is the difference between a plan and a pitch.*

## The 180-day shape

| Weeks | Focus | Gate |
|---|---|---|
| 1–2 | Advocate note on MP's leasing law + sub-registrar process + target village cluster | A written legal position |
| 3–4 | **Demand first** — 30 institutional conversations | **3 credible mandates** *(if not: stop, don't build)* |
| 5–8 | Supply against real demand; run leases entirely by hand | **3 executed leases, ≥1 registered** |
| 9–16 | Build Phase 1 (parcel dossier), rebuild the public site honestly | 40 dossiers, 10 leases |
| 17–26 | Density, lease management, Verification Packs, rate report | **20 leases, repeat customers, a fundable deck** |

## What gets built, and when

`supply → transaction → discovery → intelligence`

The master build prompt describes the destination accurately. What it lacks is the **order** — and building its Section 5 (the map) before its Section 9 (trust) is precisely how v1 produced a beautiful, empty platform.

- **Phase 1** (wk 7–16) — the **shareable parcel dossier**: PostGIS parcel, boundary capture, private documents, the verification ladder, and the `ParcelOverlayCard` signature visual. Not a marketplace — a sales instrument and an operating record.
- **Phase 2** (mo 4–8) — the **transaction rail**: enquiry → offer → agreement → eSign → registration status → payment → lease record.
- **Phase 3** (mo 8–14) — **discovery**: the polygon map, radius search, filters, dark mode, mobile bottom sheets. **Gate: ≥300 real parcels.** Not one day sooner.
- **Phase 4** (mo 12–24) — **intelligence**: price comparables, match scores, crop and satellite modules. Gate: ≥50 real transacted leases. *A number FarmKaro cannot explain is a number FarmKaro does not display.*

## The two risks that decide the outcome

**R1 — the state's leasing law may not be usable in practice.** Answered in week 1 for the price of an advocate's time. Everything downstream depends on that note.

**R4 — the founder repeats the v1 pattern.** Competitions, decks, features, no leases. Answered every week by whether the team can tolerate six months that produce no demo, no launch, no trophy — only three signed leases and a careful record of what went wrong.

**That trade — trophies for leases — is the whole relaunch.**

---

## Read next

| Doc | Contents |
|---|---|
| [`01-postmortem-v1.md`](01-postmortem-v1.md) | What v1 was, the nine failure modes, what to keep |
| [`02-market-legal-research.md`](02-market-legal-research.md) | Tenancy law, state Acts, registration, ULPIN/AgriStack, SEBI/CIS, honest TAM — fully sourced |
| [`03-strategy-v2.md`](03-strategy-v2.md) | The reframe, customers, wedge, the three assets, what FarmKaro refuses to be |
| [`04-business-model.md`](04-business-model.md) | Five revenue lines, unit economics, break-even, funding posture |
| [`05-product-roadmap.md`](05-product-roadmap.md) | Phases 0–4 with numeric gates, the verification ladder, the do-not-build list |
| [`06-technical-architecture.md`](06-technical-architecture.md) | Stack, domain modules, connector layer, PostGIS design, security |
| [`07-data-model.sql`](07-data-model.sql) | Production-shaped PostGIS schema with honesty enforced in constraints |
| [`08-gtm-first-180-days.md`](08-gtm-first-180-days.md) | Week-by-week execution plan |
| [`09-metrics-and-kill-criteria.md`](09-metrics-and-kill-criteria.md) | North star, metric tree, cadence, pre-agreed kill criteria |
| [`10-risk-register.md`](10-risk-register.md) | 15 ranked risks with mitigations |
