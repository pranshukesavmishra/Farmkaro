# 08 — Go-to-Market: The First 180 Days

*Concrete enough to start Monday. Every week has an output, not an activity.*

**The only question this plan answers:** *can FarmKaro get a landowner and a cultivator to sign a real, registered lease, and get paid for it?* Everything else is downstream.

---

## Weeks 1–2 · Legal ground truth and target cluster

| # | Action | Output |
|---|---|---|
| 1 | Retain a **revenue-law advocate in Jabalpur** (₹10–15k/mo). First brief: *what exactly is the current legal position on agricultural land leasing in MP — which Act, which rules, is it notified, what does the tehsil actually accept?* | A 2-page written note. **This is the single highest-value artifact of the entire quarter.** Do not proceed on assumptions from this document |
| 2 | With the advocate, draft **two lease templates**: (a) registered lease under the state Act, (b) short-tenure alternative — with the trade-offs written in Hindi | Templates v1 |
| 3 | Visit the **sub-registrar office** and a **tehsildar/patwari** office. Learn the real process, cost and timeline for registering an agricultural lease | Process map + cost sheet |
| 4 | Choose **15–25 villages** within 25 km of Jabalpur. Bias toward: irrigation access, road access, known out-migration (⇒ idle land), peri-urban demand | Named target cluster |
| 5 | Register the entity if not done — **Pvt Ltd**, Startup India recognition, GST, current account | Entity ready to invoice |

## Weeks 3–4 · Demand first (the inversion of v1)

**Do not start by collecting land.** Start by finding people who want land and have money. Supply gathered without a buyer is what produced a dead marketplace last time.

| # | Action | Output |
|---|---|---|
| 6 | Build a list of **60 institutional demand prospects**: FPOs in Jabalpur/Katni/Narsinghpur, seed companies with multiplication needs, nursery & floriculture operators, dairy/fodder buyers, agroforestry & orchard developers, agri-tourism, food processors | Named list with phone numbers |
| 7 | Call/meet **30 of them**. Single question: *"If I could hand you N acres near X with clean papers and a registered lease, would you take it, and what would you pay me to arrange it?"* | 30 logged conversations |
| 8 | Convert to **5 written land requirements**: acres, location, tenure, budget, crop, timeline | 5 live mandates |
| 9 | Publish a **price list** publicly (§04). Transparent pricing is the wedge against brokers | Live page |

**Gate:** if fewer than 3 credible mandates emerge, *stop and re-examine the segment before building anything*. That is a cheap, honest failure — and vastly better than another two years of platform.

## Weeks 5–8 · Supply against real demand, and lease #1

| # | Action | Output |
|---|---|---|
| 10 | Work the mandates backwards into the target villages. Walk into **panchayat offices, mandis, krishi seva kendras, tractor/input dealers, patwari halkas**. Input dealers know every farmer within 10 km — cultivate three of them as scouts on referral fees | 60+ owner conversations |
| 11 | Onboard **25 parcels manually**: Hindi form, documents to Drive, **walk the perimeter with a phone GPS**, photos, one video | 25 parcel folders + KML boundaries |
| 12 | Build the **paper dossier** for the 10 best: record extract, boundary trace with computed acreage, photos, water/road/electricity notes, asking rent | 10 PDF dossiers |
| 13 | Run three matches end-to-end **by hand**: visit → negotiate → draft → stamp → eSign/wet-sign → register → collect fee | **3 executed leases. Revenue: real.** |
| 14 | Write a **post-mortem on each lease**: where it stalled, what it cost, what the objection was, what a tool would have fixed | The Phase 1 product spec |

## Weeks 9–16 · Build Phase 1 while the desk keeps running

Engineering starts **now**, not in week 1, and it builds only what weeks 5–8 proved is needed (see §05 Phase 1). Meanwhile the desk targets **2 leases per month**.

| # | Action | Output |
|---|---|---|
| 15 | Ship parcel record + PostGIS + boundary capture + documents + verification ladder + `ParcelOverlayCard` + shareable dossier link | Phase 1 live |
| 16 | Migrate all existing parcels off Sheets into the platform | Single source of truth |
| 17 | Rebuild farmkaro.in: kill the demo data, kill "FARMLINKER PROTOCOL v4.2", Hindi-first, new positioning, real parcel dossiers as the proof | Honest public site |
| 18 | WhatsApp Business API for intake and notifications | Working channel |
| 19 | First **institutional sourcing mandate** delivered (R5) | Largest single invoice to date |

## Weeks 17–26 · Density, repeatability, and the story

| # | Action | Output |
|---|---|---|
| 20 | Reach **100 parcels, 40 with full dossiers** in the cluster | Parcel Graph v1 |
| 21 | Reach **20 cumulative executed leases** | Proof of repeatability |
| 22 | Start selling **Verification Packs standalone** to lessees and one lender/FPO | New revenue line validated |
| 23 | Launch **lease management** (rent reminders, receipts, renewals) for existing leases | Retention loop live |
| 24 | Publish the **first Jabalpur Farmland Lease Rate Report** — median rent by village/crop from *real transacted leases* | Category authority + press + inbound |
| 25 | Recruit **village-level "Land Mitras"** — one part-time person per 3–5 villages on referral commission | Scalable, capital-light supply channel |
| 26 | Assemble the **new deck**: N leases, ₹X revenue, contribution margin, cohort retention, district-level model, expansion plan | Fundable narrative (§4.4) |

---

## Channel priorities (ranked by expected CAC)

1. **Field / word-of-mouth in the cluster.** Land is a trust business; the first 50 leases will come from a person, not a funnel.
2. **Input dealers, tractor dealers, krishi seva kendras** as referral scouts. Highest leverage per rupee.
3. **FPO and agri-institution BD.** Slowest to close, largest tickets, most repeat.
4. **YouTube in Hindi.** The founders already have a channel. Content that actually works: *"ठेके पर ज़मीन देने से पहले ये 5 बातें जान लीजिए"*, walkthroughs of a real registered lease, "what the new leasing law means for your land." This is genuinely differentiated content because almost nobody explains agricultural tenancy law plainly in Hindi.
5. **SEO on parcel dossiers + district lease-rate pages.** Compounds slowly; start early because of the lag.
6. **Paid ads.** Last. Do not spend here before month 9.

## Things to explicitly *not* do in 180 days
No second district. No app store launch. No AI feature launch. No fundraising roadshow before week 20. No press release about a product that has fewer than 20 leases behind it. No hackathon or startup competition — that reflex is what cost v1 two years.
