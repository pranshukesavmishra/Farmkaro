# 03 — Strategy v2: What FarmKaro Becomes

---

## 3.1 The reframe

**v1:** *"Airbnb for farmland."*
**v2:** *"The lease-execution rail for Indian farmland."*

Airbnb works because supply repeat-transacts weekly, is standardised, and carries near-zero legal risk. Farmland leasing is the inverse: transacts twice a year at best, is entirely non-standard, and is defined by legal risk. Copying Airbnb's *form* while ignoring its *preconditions* is precisely what produced v1.

The company FarmKaro should be modelled on is not Airbnb. It is a **title-and-escrow company with excellent software** — closer to Stripe or a registrar than to a classifieds site. The polish and geospatial ambition of the master prompt stay; what changes is **what the software is for** and **when it gets built**.

### The new one-liner

> **FarmKaro makes it safe to lease out farmland — and makes leased-in land bankable.**

In Hindi, for the field: **"अपनी ज़मीन सुरक्षित रूप से ठेके पर दीजिए — कागज़ पूरे, तारीख तय, ज़मीन आपकी।"**
*(Lease your land safely — papers complete, end date fixed, land stays yours.)*

Every product decision must trace back to one of those two promises. If it doesn't, it's v1 thinking.

## 3.2 The two customers, and which one pays

**Landowner (supply).** Doesn't primarily want money — wants **safety**. Their fear is: *"if I record a tenant, do I risk my land?"* Sell them: end-date certainty, non-tenancy-creating registered lease, documented rent trail, and the ability to prove all of it. **Charge them little or nothing.** Supply must be frictionless.

**Cultivator / lessee (demand).** Wants **land with clean papers**, and — critically — a lease document a **bank, insurer or scheme will accept**. This is a hard, expensive problem they currently cannot solve. **They pay.**

And v2's sharpest departure from v1: **the lessee who pays is usually not a 2-acre smallholder.**

### The demand segments that actually have budget

| Segment | Why they lease | Ticket | Repeat |
|---|---|---|---|
| **Agri-entrepreneurs / progressive farmers scaling 10–100 acres** | Expansion beyond owned land | High | Annual |
| **FPOs & farmer collectives** | Aggregated block cultivation, nurseries | High | Annual |
| **Seed companies** needing isolation/multiplication plots | Regulatory isolation distance requirements | High | Every season |
| **Orchard / agroforestry / plantation developers** | Need 7–20 year secure tenure | Very high | Long-tenure |
| **Contract-farming & food processors** | Assured raw material near the plant | High | Annual |
| **Nursery, floriculture, agri-tourism, dairy fodder operators** | Peri-urban land near the city | Medium–high | Annual |
| **Solar / non-agri use** | *Explicitly out of scope* — different law, different conversion approvals | — | — |

These buyers have a budget line, a decision-maker, a phone that gets answered, and a **recurring** need. A ₹10,000 facilitation fee is a rounding error to them and unaffordable to a smallholder. v1 spent two years pointing its monetisation at the party with the least money.

**Smallholders are still served** — as *landowners* (free, and it's their safety we protect) and as lessees on low/zero-fee terms. Charging the institutional side is what makes serving the smallholder side sustainable. Say this out loud; it's a good story and it's true.

## 3.3 The wedge: one district, saturated

**Recommendation: Jabalpur district, Madhya Pradesh, as base of operations.**

| Why | Detail |
|---|---|
| **Legal window** | MP has enacted a separate land-leasing law derived from the NITI model — the enabling statute exists **[VERIFY LOCALLY]** |
| **Home ground** | Founders are in Jabalpur (33 Phase 2, Anantara Tilhari). Field ops cost near zero. Language, patwari relationships, college network |
| **Record availability** | MP Bhulekh serves record extracts; Bhu-Naksha cadastral layers exist for much of MP |
| **Cropping** | Kharif–rabi double cropping ⇒ two leasing windows per year, not one |
| **Peri-urban gradient** | A city of ~1.2M with real peri-urban demand (nursery, dairy fodder, agri-tourism) alongside genuine agricultural interior |
| **Existing brand equity** | Every competition credential is MP/central-India-rooted |

**The alternative worth naming:** *Maharashtra* — the MALL Act 2017 rules were notified 2 June 2025 with the framework reported operational from 8 May 2026. That is a genuinely fresh, time-boxed window with a large, commercially sophisticated leasing market. But it means operating away from home with no network and 3–5× the cost. **Recommendation: prove the model in Jabalpur; treat Maharashtra as expansion market #2 in year 2, and start building the relationship now.**

### What "saturated" means
Not "listed in." Saturated = in a chosen **cluster of 15–25 villages** within ~25 km of Jabalpur, FarmKaro knows: which parcels are idle, who owns them, what the going rent is, which patwari serves which halka, and which cultivators are looking. That is a **local data monopoly** — and unlike a UI, it cannot be copied by a competitor with a better designer.

## 3.4 Operator-led, then productised

The mechanism that kills v1's failure mode is a sequencing rule:

> **Do it by hand until it hurts. Only then write code — and write code only for the part that hurt.**

**Phase 0 is not a platform. It is a Lease Desk.** Two people, a WhatsApp number, a spreadsheet, a scooter, a lawyer on retainer, and a target of **three executed leases**. Everything learned in those three leases — every document actually asked for, every objection actually raised, every fee actually paid — becomes the specification. This is how you find out that (say) the real blocker is the sub-registrar appointment queue, not the map.

This is not "MVP theatre." It is the only way to discover that the software you were about to spend six months on solves the wrong step.

## 3.5 The three assets being built

Everything in this plan compounds into exactly three defensible assets. If a proposed feature builds none of them, cut it.

1. **The Parcel Graph** — verified, boundary-mapped, document-backed parcels with owner linkage and real transacted rent history, ULPIN-joinable. Every executed lease deepens it. Nobody else in India is accumulating this at the district level.
2. **The Trust Operation** — a repeatable, staffed pipeline that turns an unknown plot into a documented, inspected, dossier-backed parcel. Process + people, not code. Slow to copy.
3. **Transacted Price Data** — actual signed lease rents by village, crop and season. This is what eventually makes the master prompt's AI Price Recommendation honest rather than invented — and it is a saleable data product to lenders and insurers later.

## 3.6 What FarmKaro explicitly refuses to be

| Refused | Reason |
|---|---|
| A land **buy/sell** classifieds site | Different (worse) business, fraud-adjacent, distracts. v1's #1 scope error |
| An **agri-investment / fractional ownership** product | Unregistered-CIS risk — see §2.5. Hard stop |
| A **crop-sale marketplace** taking 10% | Margin doesn't exist; unenforceable; a whole second company |
| An **IoT / drone hardware** vendor | Inventory + working capital + service. Not a software company |
| A **national** listings site in year 1 | Thin map, zero liquidity — v1's #6 failure mode |
| A claimant of **government verification** | Never. Legally and ethically off-limits |
| An **escrow provider** | Until a regulated arrangement is genuinely live, the word does not appear in the UI |
| A **lender** | Refer to banks/NBFCs; do not lend, do not guarantee |

Print this table. Every scope-creep conversation for the next 18 months ends by pointing at it.

## 3.7 Brand and positioning corrections

- **Kill "FARMLINKER PROTOCOL V4.2."** Invented technical jargon reads as theatre to exactly the sophisticated audience it's meant to impress.
- **Kill all demonstration data**, or move it behind an obvious `/demo` route. A public site that disclaims its own content teaches visitors not to trust the company.
- **Retire "Empowering Farmers with Intelligence."** Too abstract, promises intelligence FarmKaro doesn't yet have. Replace with the §3.1 line.
- **Lead in Hindi.** English-first is a competition-deck habit. The landowner in Panagar does not read "Institutional Agricultural Intelligence."
- **Keep** the name, the `#003622` forest-green identity, the wheat-sheaf mark, and the honesty rules from the master prompt.
- **Make honesty the positioning, not a disclaimer.** "We show you exactly what we checked and what we didn't" is a *differentiator* in a land market defined by opacity. Publish the verification ladder (§05) publicly.
