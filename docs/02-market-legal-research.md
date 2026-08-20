# 02 — Market & Legal Ground Truth

*Everything here is sourced. Where a fact is state-specific or time-sensitive, it is flagged **[VERIFY LOCALLY]** — meaning: confirm with a practising revenue advocate in that state before it drives a product decision. This document is research, not legal advice.*

---

## 2.1 The tenancy problem is the market

**Leased-in land as a share of operational holdings has roughly doubled** — from ~6% (2002–03) to ~10.3% (2012–13) to **~13% (2018–19, NSS 77th round)**, while owned share fell from 92.7% to 85.6%. Tenancy is *growing* while remaining mostly informal and legally invisible.

Why it stays informal: states including **Bihar, Karnataka, Madhya Pradesh, Chhattisgarh, Uttar Pradesh, Uttarakhand, Himachal Pradesh, Tripura, Telangana and Odisha** historically permitted leasing out only by *specified categories* of owner — the disabled, widows, unmarried/separated/divorced women, serving armed-forces members, and similar. Everyone else leasing out was either technically prohibited or exposed to tenancy claims.

The consequence, and the entire commercial opening:

> An informal tenant cannot get a **crop loan**, **crop insurance**, **disaster compensation**, or most **input subsidies**, because none of those instruments can see them. And the landowner cannot prove the arrangement ends when they say it ends.

Both sides are worse off than they'd be with a clean, registered, non-tenancy-creating lease. **That gap is the product.**

## 2.2 The legal window that has opened since v1 was pitched

This is the most important change in the environment, and it is *new*:

- **NITI Aayog's Model Agricultural Land Leasing Act, 2016** was designed to legalise leasing while explicitly protecting the owner's title.
- **Madhya Pradesh has enacted a separate land-leasing law** based on it; **Uttar Pradesh and Uttarakhand** modified their existing leasing laws. Odisha, Andhra Pradesh and Telangana have been reported at advanced stages. **[VERIFY LOCALLY]**
- **Maharashtra Agricultural Land Leasing Act, 2017** received Presidential assent and was published in the Maharashtra Gazette on **27 June 2023**; the **Maharashtra Agricultural Land Leasing Rules, 2024 were notified 2 June 2025**, with the operational framework reported as implemented from **8 May 2026**. **[VERIFY LOCALLY]**

The design principle common to these statutes, and the one sentence a landowner needs to hear:

> **A lease executed under these Acts does not create protected tenancy or occupancy rights, and possession is deemed to revert to the owner on expiry unless a fresh registered lease is executed.**

That single legal fact is worth more to FarmKaro than every AI feature in the master prompt combined. It converts "leasing my land is dangerous" into "leasing my land is a contract with an end date." **FarmKaro v2's core job is to make that fact true, provable, and easy for one specific landowner on one specific parcel.**

Note the sober caveat from the commentary on Maharashtra, which applies everywhere: the law's success "will depend on awareness among landowners and cultivators, smooth registration practices, responsive revenue administration, and acceptance of registered lease deeds by banks, insurers and local authorities." Every one of those four dependencies is an operational service someone has to perform. **That someone is the business.**

## 2.3 Registration, stamping and e-sign — what's actually required

- Under **§17 Registration Act, 1908** and **§107 Transfer of Property Act, 1882**, a lease of immovable property **exceeding 12 months must be registered**. Leases of 11 months or less are generally exempt from compulsory registration.
- **Stamp duty is state-specific**, commonly in the range of ~2–5% of annual rent for lease instruments. **[VERIFY LOCALLY]**
- **Aadhaar eSign is legally valid** under **§3A of the IT Act, 2000** — an eSigned document has the same validity as a wet signature.
- **But e-sign does not replace registration or stamping.** An eSigned, unregistered, unstamped 3-year agricultural lease is weaker than the founder would like it to be.
- State leasing Acts additionally require leases under the Act to be **registered**, with the Competent Authority maintaining a prescribed register of such transactions.

**Product consequences (non-negotiable):**
1. `lease.registration_status` is a first-class field with real states: `unregistered` → `stamped` → `submitted_for_registration` → `registered`. Never collapse this into a green tick.
2. The **11-month workaround is a trap to be used knowingly, not by default.** It dodges registration but for *agricultural* land it can interact badly with tenancy law and it produces a lease that banks and insurers won't accept — which defeats the main benefit the tenant is buying. Default to registered leases under the state Act; offer 11-month only as an explicitly explained downgrade.
3. Integrate a **licensed ASP/ESP** for Aadhaar eSign (Leegality, Digio, NSDL, eMudhra, Zoop and similar). Never roll your own signature.

## 2.4 The digital land-record substrate (also new since v1)

- **DILRMP / ULPIN ("Bhu-Aadhaar")** assigns a **14-digit unique ID to a land parcel derived from its lat/long coordinates**. This is a national parcel primary key — exactly the object the master prompt says should be the core object.
- **AgriStack Farmer Registry** issues an **11-digit Farmer ID linked to Aadhaar and to land records**, recording identity attributes against **Land Parcel ID and Survey Number**. Multiple states run integrated modules, with API-based exchange.
- **Bhu-Naksha** provides cadastral map layers in many states; **MP Bhulekh** serves MP record extracts.

**Product consequence:** design `land_parcels.ulpin` and `users.farmer_registry_id` into the schema **now**, as nullable, verifiable fields. When state APIs open up (or when a user simply reads their number off a document), FarmKaro's parcels become joinable to the national substrate on day one instead of requiring a migration. This is the highest-leverage piece of "future-proofing" available, and it costs two columns.

**Hard rule, carried from the master prompt:** *scraping a state Bhulekh portal is not an integration.* Build `LandRecordsConnector` with a manual/`operator_entered` provider as the default implementation, and only add an automated provider where access is legally and technically permitted.

## 2.5 The regulatory landmine v1 was walking toward

The v1 deck sold "Landowner Partnerships — land leasing + revenue sharing" and courted "investors." **Stop.**

**SEBI issued an interim order on 29 January 2024 against Growpital**, an agri-investment platform offering 11–14% "tax-free assured profit share," holding it to be an **unregistered Collective Investment Scheme**. SEBI has explicitly clamped down on schemes structured as "fractional ownership" or "joint partnership" where the substance is pooled returns: *"If returns are pooled and not tied to an individual, demarcated holding with owner control, the arrangement risks being classified as an unregistered Collective Investment Scheme."*

**Hard stops for FarmKaro v2 — no exceptions without written counsel:**
- ❌ No pooled agri-investment product, no assured/indicative returns, no fractional farmland ownership.
- ❌ No "invest in farmland from ₹X" surface, ever.
- ❌ No holding of user money on FarmKaro's own books. Use a **licensed Payment Aggregator** (Razorpay / Cashfree / PhonePe PG) under RBI's PA/PG framework. **"Escrow-ready" means the code has the abstraction; it does not mean escrow exists.** Never render the word "escrow" in the UI until a regulated arrangement is actually live.
- ❌ No claim of government verification, ever. `document_verified_by_farmkaro` ≠ `verified_by_government`.

## 2.6 Competitive landscape — honest read

- **SFarmsIndia** — the closest incumbent; digital platform for buying/selling/leasing agri land. Largely a **listings + brokerage** model.
- **99acres / OLX / Facebook groups / local dalals (brokers)** — the real competition. Free, and they already have the supply.
- **Farmonaut, BharatAgri, BigHaat, DeHaat, Agrowave** — adjacent agritech (advisory, inputs, output linkage). Not competitors; **potential demand-side partners** — their agri-entrepreneur networks need land.
- **Managed-farmland / agri-plotting developers** — adjacent, and carry the CIS risk described in §2.5. Do not be confused with them; **actively differentiate**.

**The white space is unambiguous:** nobody is selling *lease execution and legal safety as a service*. Everybody is selling *listings*. v1 tried to out-list the listers with a nicer UI. v2 should refuse to compete on listings at all.

## 2.7 Honest market sizing (replacing "$13.8 Trillion")

The v1 deck's TAM slide is the classic tell — global agriculture GDP is not a market FarmKaro can address. Build it bottom-up instead, and label every assumption:

**Bottom-up, one district (illustrative, Jabalpur-scale) — ASSUMPTIONS, NOT DATA:**

| Line | Assumption | Value |
|---|---|---|
| Net sown area, one MP district | order of magnitude | ~250,000 ha ≈ 620,000 acres |
| Share plausibly leased (at ~13% national tenancy) | NSS-anchored | ~80,000 acres |
| Share reachable/formalisable in 5 yrs | judgement | 5% → **4,000 acres** |
| Avg lease parcel | judgement | 4 acres → **1,000 leases/yr** |
| Avg annual rent | ₹15,000/acre **[VERIFY LOCALLY — varies enormously]** | ₹60,000/lease |
| Rent value flowing through | | **₹6 Cr/yr per district** |
| FarmKaro take (≈10% blended, §04) | | **₹60 L/yr per district** |

At ~₹60 L revenue per saturated district and ~700 districts in India, a credible ceiling is **hundreds of crores, not lakhs of crores** — and it is *earned district by district*. That is a real, fundable business and an honest slide. Reported lease rates range from very low in rain-fed areas to ₹50,000–₹1,50,000/acre/year for prime peri-urban land, so district economics vary by an order of magnitude — which is itself an argument for choosing the base district deliberately.

**Use this framing in the next pitch.** "₹60 lakh per district, proven in one, repeatable in 700" beats "$471 billion market" with every serious investor.

---

## Sources

- [NITI Aayog — Report of the Expert Committee and Model Law on Agricultural Land Leasing (PDF)](https://www.niti.gov.in/sites/default/files/2023-02/Report-of-the-Expert-Committee-and-Model-Law-on-Agricultural-Land-Leasing.pdf)
- [Model Agricultural Land Leasing Act, 2016 — NITI for States](https://www.nitiforstates.gov.in/policy-viewer?id=ANCNAA000094)
- [PIB — Highlights of initiatives under NITI Aayog](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1491616)
- [Business Standard — A few states move towards model agricultural land leasing Act](https://www.business-standard.com/article/news-ians/a-few-states-move-towards-model-agricultural-land-leasing-act-official-118112301020_1.html)
- [The Maharashtra Agricultural Land Leasing Act, 2017 (India Code, PDF)](https://www.indiacode.nic.in/bitstream/123456789/20994/1/the_maharashtra_agricultural_land_leasing_act,_2017.pdf)
- [PRS — Maharashtra Act No. 28 of 2023 (PDF)](https://prsindia.org/files/bills_acts/acts_states/maharashtra/2023/Act28of2023MH.pdf)
- [Law Web — New Agricultural Land Leasing Framework implemented from 08 May 2026](https://www.lawweb.in/2026/05/new-agricultural-land-leasing-framework.html)
- [Mondaq — Leasing of Agricultural Land: Pandora's Box](https://www.mondaq.com/india/landlord-tenant-leases/1347146/leasing-of-agricultural-land-pandoras-box)
- [World Bank — South Asia Agriculture and Rural Growth Discussion Note (PDF)](https://documents1.worldbank.org/curated/en/099146505182228575/pdf/IDU0d22dfb1208bb304c21085bd05309c918d457.pdf)
- [Agricultural Tenancy in Contemporary India — analytical report (PDF)](https://archive.indianstatistics.org/sserwp/sserwp1801.pdf)
- [NSS 77th Round — Situation Assessment of Agricultural Households](https://ruralindiaonline.org/en/library/resource/situation-assessment-of-agricultural-households-and-land-and-livestock-holdings-of-households-in-rural-india/)
- [Deccan Herald — Bhu-Aadhaar for rural land parcels (Union Budget 2024)](https://www.deccanherald.com/amp/story/business%2Funion-budget%2Funion-budget-2024-government-proposes-bhu-aadhaar-for-rural-land-parcels-digitisation-of-urban-land-records-3117712)
- [Finshots — SEBI cracks the whip on an agri-investment startup (Growpital)](https://finshots.in/archive/sebi-cracks-the-whip-on-an-agri-investment-startup/)
- [Vinod Kothari Consultants — Fractional ownership vs. collective investment schemes](https://vinodkothari.com/2023/09/fractional-ownership-schemes-distinguishing-between-investment-schemes-and-shared-ownership-of-real-assets/)
- [IndiaCorpLaw — Overlap in CIS and joint ownership structures](https://indiacorplaw.in/2024/04/14/demystifying-overlap-in-collective-investment-schemes-and-joint-ownership-structures/)
- [Diligence Certification — Lease registration in India: process, documents, rules](https://www.diligencecertification.com/lease-registration/)
- [NoBroker — Lease agreement for agricultural land: guide & formats](https://www.nobroker.in/lease-agreement/guides/lease-agreement-for-agricultural-land/)
- [Swasya — Cost to lease farmland in India (2025)](https://www.swasya.com/blog/cost-to-lease-farmland-in-india)
