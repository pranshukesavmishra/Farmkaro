# 01 — Post-mortem: What FarmKaro v1 Actually Was, and Why It Didn't Work

*Written from primary evidence only: the FK investor deck (14 slides), the live farmkaro.in site, and the v2 master build prompt. No outcome is assumed that the evidence doesn't support.*

---

## 1.1 What the evidence actually shows

**From the deck:**

| Slide | What it said |
|---|---|
| What is FarmKaro | "A digital platform for seamless land transactions… connects landowners with **buyers**… simplifies the **buying and selling** process" |
| Vision | "A smart, accessible, and profitable **land marketplace** for everyone" |
| Problems | Idle land · limited capital access · no structured leasing · lack of trust · fragmented supply chain |
| Opportunity | Land leasing **+** access to capital **+** market linkages **+** technology integration |
| Solution | Connects landowners, farmers **and investors**; smart matching; end-to-end support |
| USP | Land accessibility · farmer support ecosystem · business & employment generation · data-driven insights |
| Market | "$13.8 Trillion global" / "$471 Billion India" / "~₹109 Lakh Crore" |
| Business model | 10% commission on crop sales · ₹500/mo subscription · ₹10,000/report analytics · **IoT sensor & drone hardware sales** · advertising slots |
| Achievements | Campus Tycoon 2.0 (JEC Jabalpur) · Eureka! 2024 zonalist (IIT Bombay) · E-Summit'25 (IIT Roorkee) · E-Summit'24 (MANIT Bhopal) |
| Ask | Raising at **₹10 Cr valuation** |
| Team | Pranshu Mishra (Founder), Aryan Singh (Co-founder), Jabalpur MP |

**From the live site (farmkaro.in):**
- Positioning: *"Empowering Farmers with Intelligence"* / "Institutional Agricultural Intelligence"
- A visible badge on the hero: **"NOTE: DATA SHOWN IS FOR DEMONSTRATION PURPOSES ONLY"**
- A nav chip labelled **"FARMLINKER PROTOCOL V4.2 // SECURE"**
- Nav: Home · Marketplace · Services · Resources; CTA `go_to_dashboard`
- Prior deployment: `farmkaro-fk.netlify.app`

**What is conspicuously absent from every artifact:** a single traction number. No parcels listed, no leases executed, no GMV, no users, no revenue, no retention, no district. Two years of work produced a well-designed *presentation* of a business.

---

## 1.2 The nine failure modes

### FM-1 · It was optimised for judges, not for landowners
Every "Achievement" is a startup-competition placement. Competitions reward narrative breadth, polished decks and TAM slides. Customers reward one thing working. The feedback loop the company actually trained on was the wrong loop — and it ran for two years.

### FM-2 · Scope sprawl: five businesses, two people, zero revenue
Land leasing, land buying/selling, farmer financing, produce market linkage, IoT/drone hardware, paid analytics reports, and ad slots. Each of these is a company. Running them as "an ecosystem" means none of them ever reached the depth where a customer would pay.

### FM-3 · The revenue model was arithmetically detached from the customer
- **10% commission on crop sales** — Indian crop trade runs on 1–3% margins at the aggregator level. Nobody pays 10%, and it is unenforceable the moment the two parties can transact off-platform (which for a physical commodity is always).
- **₹500/month SaaS to smallholders** — average Indian operational holding is ~1.08 ha. That is ₹6,000/year against a farm netting perhaps ₹40–80k/year. This ARPU does not exist.
- **₹10,000/report to institutions** — you have no proprietary data to put in the report.
- **IoT sensors and drones** — a hardware distribution business with working capital, inventory, service and warranty obligations, bolted onto a software startup.

### FM-4 · Demo-ware shipped as product
The live site carries its own disclaimer that the data is fake. "FARMLINKER PROTOCOL V4.2" is invented technical theatre — it signals to any operator or investor who looks closely that the surface is ahead of the substance. A marketplace with a beautiful UI and zero supply converts at zero.

### FM-5 · The actual product was never built — because the actual product is legal, not digital
This is the central diagnosis. **Farmland leasing in India is a legal-risk product wearing a software interface.** The reason 87% of land is *not* formally leased is not that landowners couldn't find a website. It is that:
- most states restrict or prohibit agricultural tenancy outright;
- landowners fear that a recorded tenant acquires occupancy/protected-tenancy rights and their title becomes contestable;
- so leasing happens **orally**, invisibly, and unbankably.

v1's deck named "No structured land leasing system" as a problem, then proposed a *listings and matching* solution. Matching was never the bottleneck. **Safe, reversible, provable, registered leasing** is the bottleneck. A platform that does not make a landowner strictly safer than an oral lease has offered them nothing.

### FM-6 · Wrong marketplace physics
Marketplaces need liquidity. Land has the worst possible liquidity profile:
- **Hyper-local** — a farmer will not lease land 60 km away; the real radius is 5–25 km.
- **Seasonal** — the transaction window is ~2 per year (kharif ~May–June, rabi ~Oct–Nov). Miss it and you wait six months.
- **Low frequency** — a landowner leases perhaps once every 1–5 years.
- **Non-standard** — no two parcels are comparable in the way two hotel rooms are.

A *national* listing site therefore produces a thin, dead map. The correct unit of scale is not "India" — it is **one district, saturated**.

### FM-7 · Tech-first sequencing
The site was built before there were parcels to put on it. Ordering matters: supply → transaction → discovery → intelligence. v1 built discovery and intelligence surfaces first because they demo well.

### FM-8 · No retention loop
Matching two parties once earns one fee once. CAC never amortises, and the platform is disintermediated on the second transaction. There was no recurring surface — no rent collection, no renewal, no lease administration, no compliance calendar.

### FM-9 · Trust was asserted, not manufactured
"Verified land assets" appeared as a claim with no verification pipeline, no document-review queue, no field inspection, no evidence chain. Trust in land is *produced* — by someone physically standing on the parcel, pulling the record extract, and putting their name on the finding. That's an operations business, and it was never staffed.

---

## 1.3 What v1 got right (keep these)

1. **The problem statement is real.** "Agriculture suffers not from lack of potential, but lack of structure" is a correct thesis. Idle land + landless cultivators + no safe leasing rail = a genuine market failure worth a company.
2. **The name.** *FarmKaro* is short, bilingual, imperative, memorable, and owns a `.in`.
3. **Geographic base.** Jabalpur, Madhya Pradesh is an *advantage*, not a limitation — see §03.
4. **Honesty instinct.** Both the live site's demo-data disclaimer and the master prompt's repeated "never fabricate government verification" rules show the right ethical reflex. That instinct is the brand's most valuable asset in a category full of land-scam adjacency. Institutionalise it.
5. **The design ambition.** The v2 master prompt's parcel-polygon-first, non-OLX visual direction is correct — it is just sequenced too early. It becomes valuable the moment there is real supply to render.

---

## 1.4 The single sentence

> **v1 built a marketplace interface for a problem whose bottleneck is legal risk, in a market whose liquidity is district-level, funded by a revenue model its customers could not afford, and measured itself against competition judges instead of executed leases.**

Everything in §03 onward follows from inverting that sentence.
