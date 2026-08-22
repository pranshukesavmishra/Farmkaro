# 04 — Business Model & Unit Economics

*All figures are **illustrative assumptions** for planning, not observed data. Every one must be replaced with a real number after the first ten leases. That discipline — labelling assumptions as assumptions — is what v1's deck lacked.*

---

## 4.1 Revenue architecture

Five lines, deliberately ordered by how soon they can be true.

### R1 · Lease Facilitation Fee — *live from lease #1*
Charged to the **lessee**. Covers matching, dossier, negotiation support, agreement drafting.
- **6% of first-year rent, floor ₹5,000, cap ₹40,000.**
- On a ₹60,000/yr lease: **₹5,000**. On a 40-acre orchard lease at ₹6,00,000/yr: **₹36,000**.
- Landowner side: **₹0.** Supply must be frictionless.

### R2 · Documentation & Registration Service — *live from lease #1*
The single most under-served, highest-willingness-to-pay service in the whole chain. Drafting under the applicable state Act, stamping, sub-registrar coordination, eSign, certified copies.
- **₹6,000–₹15,000 per lease**, plus pass-through of stamp duty and registration fees at cost (never marked up — mark-up here destroys trust and invites scrutiny).
- Delivered with a **panel advocate**, not by FarmKaro pretending to practise law.

### R3 · Parcel Verification Pack — *live from month 2*
A due-diligence dossier on a specific parcel: record extract, boundary survey/GPS walk, physical inspection report with photos, encumbrance observations, access/water/electricity verification.
- **₹3,500–₹8,000 per parcel**, sold to lessees pre-commitment, and later to **lenders, insurers, FPOs and corporates** as a standalone product.
- Strategically the most important line: it is revenue that **directly funds the Parcel Graph**. You get paid to build your own moat.

### R4 · Lease Management Annuity — *live from month 6*
The retention loop v1 never had. Rent-schedule reminders, payment rail, receipts, renewal handling, compliance calendar, dispute documentation.
- **2.5% of annual rent per year**, or ₹2,000/lease/yr, whichever is higher.
- Small per-lease. But it **compounds**, it's the reason a customer opens the app in month 7, and it is the only line that makes CAC amortise.

### R5 · Institutional Land Sourcing — *live from month 4, lumpy but large*
A seed company needs 200 acres of isolation plots. A processor needs 500 acres near the plant. An agroforestry developer needs 1,000 acres on 15-year tenure. FarmKaro runs a sourcing mandate.
- **Retainer ₹50,000–₹2,00,000 + per-acre success fee.**
- One mandate can exceed a quarter of retail revenue. **This is likely where the first ₹10 lakh of revenue actually comes from.** Do not neglect it while chasing consumer volume.

### Deliberately deferred (year 2+, and only if earned)
Data licensing to lenders/insurers · insurance & credit referral commissions · premium SaaS for institutional landholders (temples, trusts, corporates, educational institutions with large idle landbanks — a genuinely underrated segment) · white-label for state agri departments.

### Permanently off the table
Crop-sale commission · IoT/drone hardware · pooled investment products · lending off own book.

## 4.2 Blended unit economics (illustrative)

**Retail lease, ~4 acres @ ₹15,000/acre/yr = ₹60,000/yr**

| Line | Amount |
|---|---|
| R1 Facilitation (6%, floor) | ₹5,000 |
| R2 Documentation | ₹7,000 |
| R3 Verification pack | ₹4,000 |
| R4 Management (yr 1) | ₹2,000 |
| **Gross revenue / lease** | **₹18,000** |
| Advocate/panel cost | −₹3,000 |
| Field ops (2 visits, survey, travel) | −₹2,500 |
| eSign + PG + storage + maps | −₹600 |
| **Direct cost** | **−₹6,100** |
| **Contribution margin** | **₹11,900 (66%)** |
| Recurring yr 2+ (R4 + renewal R2) | ~₹4,500/yr |

**Institutional lease, 30 acres @ ₹18,000/acre = ₹5,40,000/yr**

| Line | Amount |
|---|---|
| R1 (6%, capped) | ₹32,400 |
| R2 Documentation | ₹15,000 |
| R3 Verification (multi-parcel) | ₹18,000 |
| **Gross / lease** | **₹65,400** |
| Direct cost | −₹18,000 |
| **Contribution margin** | **₹47,400 (72%)** |

**Implication:** ~**5 institutional leases ≈ 27 retail leases** in contribution. The go-to-market should be *demand-led and institution-first*, with retail volume built underneath it. This is the exact inverse of v1's plan.

## 4.3 Path to break-even (illustrative)

Monthly fixed cost, lean Jabalpur setup:

| Item | ₹/month |
|---|---|
| 2 founders (survival stipend) | 40,000 |
| 1 field executive | 22,000 |
| Panel advocate retainer | 15,000 |
| Infra (Postgres/PostGIS, Redis, S3, Maps, eSign, WhatsApp API) | 12,000 |
| Office/travel/misc | 15,000 |
| **Total** | **₹1,04,000** |

Break-even ≈ **₹1.05L contribution/month** ≈ **9 retail leases**, or **2 institutional + 3 retail**, or **1 sourcing mandate + 4 retail**.

**Nine leases a month in one district is a realistic, human-scale target.** Compare to v1's implicit requirement — thousands of ₹500 subscribers, a crop-trade book, and a hardware line. *That* is the difference between a plan and a pitch.

## 4.4 Funding posture

**Do not raise at ₹10 Cr on zero traction.** Any investor who takes agri seriously will ask for executed leases and there are none; the ask damages credibility and burns the intro.

**Recommended path:**

**Stage 1 — Bootstrap / friends & family, ₹8–15 lakh, months 0–9.**
Enough for 12 months at the burn above with founders on stipend. Buys the only thing that matters: **30–50 executed leases and real unit economics.**

**Stage 2 — Angel / pre-seed, ₹75L–₹1.5 Cr, months 9–15.**
Raise on: *"₹X lakh revenue from N executed leases in one district, 66–72% contribution margin, Y% of lessees returning for a second lease. We are opening district #2 and #3."* Realistic post-money **₹6–10 Cr** — the number v1 asked for, but earned.

**Non-dilutive to pursue in parallel:**
- **MP Startup Policy** grants/incubation; **Startup India** recognition (tax and compliance benefits)
- **NABARD** rural innovation and agri-business incubation funding
- **RKVY-RAFTAAR** Agribusiness Incubation (agri-startups, grant-in-aid, cohort-based)
- **a-IDEA / ICAR-NAARM**, **IIM/IIT agri incubators**
- **NABVENTURES**, **Omnivore**, **Ankur Capital** for the eventual institutional round

Given the founders' competition track record, they already know how to win selection processes. **Point that existing skill at grant capital instead of at pitch trophies.** Same skill, real money, no dilution.

## 4.5 Pricing principles

1. **The landowner never pays to list.** Ever.
2. **Price the service, not the match.** Facilitation fees are disintermediated the moment the parties have each other's number; documentation, verification and registration are not.
3. **Pass through statutory costs at cost, itemised.** Stamp duty and registration fees are shown as line items. Never bundle them opaquely.
4. **Publish the price list.** Opacity is the incumbent broker's business model. Transparent pricing *is* the wedge.
5. **No success fee on rent collection** in year 1 — it makes FarmKaro look like a rent-farming intermediary. Charge a flat management fee instead.
6. **Never take a cut of crop output.** That is share-cropping and it drags you into tenancy law as a party.
