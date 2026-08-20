# 09 — Metrics, Review Cadence, and Kill Criteria

---

## 9.1 North star

> **Executed leases per month in the base district.**

Not users. Not listings. Not app downloads. Not GMV. **Executed leases** — because it is the only metric that proves a landowner overcame their legal fear, a lessee paid, and the whole chain worked.

A secondary quality gate rides on it: **% of executed leases that are registered.** An unregistered lease is a weaker product, and if that share stays low it means the legal core isn't working and FarmKaro has quietly become a broker.

## 9.2 The metric tree

**Supply**
- Parcels onboarded / month
- % with a complete dossier (documents + walked boundary + photos)
- % with `geometry_status ≥ boundary_walked_by_farmkaro`
- Owner drop-off point in the intake funnel

**Demand**
- Qualified lessee enquiries / month (qualified = budget + timeline + acreage stated)
- Live institutional mandates
- Acres demanded vs. acres available in the cluster — *the truest measure of market fit*

**Conversion funnel** (instrument every step from Phase 0, on paper if necessary)
`enquiry → visit → offer → terms agreed → signed → registered → paid`
Watch **time-to-lease** (target: < 30 days enquiry → signed) and identify the single largest drop-off each month. That drop-off *is* next month's roadmap.

**Money**
- Revenue by line R1–R5 (§04)
- Contribution margin per lease (target ≥ 60%)
- CAC by channel
- % revenue from repeat customers *(the metric v1 could never have had)*

**Trust & quality**
- Document review turnaround (target < 48 h)
- Disputes per 100 active leases (target < 3)
- Field-visit-to-listing accuracy (how often does reality match the dossier?)
- Area variance flags resolved

**Never measured, never celebrated:** page views, sign-ups, "listings", app downloads, competition placements, LinkedIn impressions. v1 optimised these to death.

## 9.3 Cadence

- **Daily (10 min):** enquiries in, leases in flight, blockers.
- **Weekly (60 min):** funnel review, one drop-off diagnosed, one experiment chosen.
- **Monthly:** cohort retention, revenue by line, CAC by channel, unit economics refreshed with *actual* numbers replacing the §04 assumptions.
- **Quarterly:** phase-gate review against §05 — has the gate number been hit? If not, do **not** advance the phase. Ship nothing from the next phase until the current gate is met. This rule is the entire defence against repeating v1.

## 9.4 Kill / pivot criteria — decided in advance, in writing

Deciding these *now*, while unattached, is what prevents another two years of sunk-cost momentum.

| Checkpoint | Condition | Action |
|---|---|---|
| **Week 4** | < 3 credible institutional mandates from 30 conversations | **Stop.** Re-test the segment before building. Try a different demand segment or district |
| **Week 8** | 0 executed leases | **Stop and diagnose.** Is the blocker legal, trust, price, or demand? Do not proceed to engineering |
| **Week 8** | Leases happen, but no one will pay a fee | Pivot monetisation to **Verification Packs sold to lenders/institutions** (R3) — a real business on the same asset |
| **Month 6** | < 10 cumulative executed leases | The district or the segment is wrong. Change **one** variable, not both |
| **Month 6** | Leases work but < 30% get registered | The legal core isn't landing. Escalate: deeper advocate engagement, or reconsider the state |
| **Month 9** | Contribution margin < 40% | Ops is too manual to scale. Automate the top cost line or raise prices |
| **Month 12** | < 40 cumulative leases and no repeat customers | The thesis is wrong at district level. **Do not raise. Do not expand.** Return to first principles |
| **Any time** | A regulator, or counsel, flags a product as CIS-adjacent or as unlicensed payment handling | **Shut that surface down the same day** (§2.5) |

## 9.5 The one-line dashboard

Pin this above the desk. If it can't be filled in truthfully, nothing else matters:

```
Leases executed this month: __    Registered: __    Revenue: ₹__
Parcels with full dossier: __     Live mandates: __    Time-to-lease: __ days
Biggest funnel drop-off: ______________________
```
