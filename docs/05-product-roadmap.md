# 05 — Product Roadmap: What Gets Built, In What Order, and Why

*The master build prompt describes the destination well. This document is the **order**. Building the master prompt's Section 5 (map experience) before its Section 9 (trust) is exactly how v1 ended up with a beautiful, empty platform.*

**Sequencing law:** `supply → transaction → discovery → intelligence`.
Each phase gates on a **real-world number**, not a date.

---

## Phase 0 — The Lease Desk (Weeks 1–6) · *Zero platform code*

**Gate to exit: 3 executed leases, at least 1 registered.**

| Tooling | Not a product |
|---|---|
| One WhatsApp Business number | Landowner + lessee intake |
| Google Form (Hindi) | Parcel intake |
| Google Sheet | The "database" |
| Google My Maps / phone GPS | Boundary capture (walk the perimeter, export KML) |
| Google Drive | Documents |
| Panel advocate | Drafting + registration |
| A physical notebook | Every objection, every question, every fee actually paid |

**What you are actually buying with these six weeks:** the specification. Which documents get asked for in reality (not in theory). What the sub-registrar actually requires. What a landowner says at the exact moment they hesitate. Whether the lessee will pay ₹7,000. Whether MP's leasing law is being used on the ground or whether the tehsil is still doing it the old way **[VERIFY LOCALLY]**.

**Anti-goal:** do not write a line of application code in Phase 0. If there is spare engineering time, spend it on §07's schema and on the deployment skeleton — not on screens.

---

## Phase 1 — The Parcel Dossier (Weeks 7–16) · *First real software*

**Gate to exit: 40 parcels with complete dossiers, 10 executed leases.**

The first thing worth building is **not** the marketplace. It is the **shareable parcel dossier** — a single, beautiful, permanent URL per parcel that FarmKaro's own team uses as its selling instrument and operating record.

**Why this first:** it is simultaneously (a) the internal operating system for the Lease Desk, (b) the sales artifact you WhatsApp to a prospective lessee, (c) the beginning of the Parcel Graph, and (d) the surface on which every later feature hangs.

**Build:**
- Auth (phone OTP), roles: `owner` / `lessee` / `ops` / `admin`
- **Parcel record** on PostGIS: polygon geometry, area, perimeter, centroid, khasra, village/tehsil/district/state, nullable `ulpin`
- Boundary capture: **map draw + GeoJSON/KML import + "walk the perimeter" GPS trace**. The GPS walk matters more than the draw tool — it is how a field executive actually records a real boundary
- Media: photos, video, thumbnails to object storage
- **Documents with private signed URLs** — resource-level authorization from day one (master prompt §20; a farmer must never reach another user's document by changing an ID)
- **The verification ladder** (see §5.5) rendered honestly
- **`ParcelOverlayCard`** — the master prompt's signature visual (satellite base, animated dashed boundary, floating glass stat pills). Built here, in Phase 1, because it is a *sales tool*, not decoration
- Public shareable dossier link with owner-controlled privacy (documents never public)
- Ops console: parcel intake queue, document review queue

**Deliberately not built yet:** search, filters, radius, map browse, chat, payments, AI. There are 40 parcels — a list is better than a search box.

---

## Phase 2 — The Transaction Rail (Months 4–8)

**Gate to exit: 30 executed leases, 60% of them running through the software rather than WhatsApp.**

Now automate the pipeline the Lease Desk has been running by hand:

`enquiry → visit request → offer → counter-offer → terms agreed → agreement generated → eSign → payment → lease activated`

**Build:**
- Enquiry & offer objects with a real state machine and full event log
- **Agreement generation** from state-specific templates (MP first), variable-filled, advocate-reviewed before every send in year 1 — no unreviewed auto-drafting
- **eSign via a licensed ASP/ESP** (Leegality / Digio / NSDL / eMudhra)
- **`registration_status` lifecycle**: `unregistered → stamped → submitted → registered`, with the registered instrument stored
- **PaymentService abstraction** over a licensed PA (Razorpay first, PhonePe/UPI/Cashfree behind the same interface). FarmKaro never touches funds. **The word "escrow" does not appear in the UI**
- Lease record: parties, parcel, dates, rent, payment schedule, documents, event timeline
- Notifications: in-app + **WhatsApp** (the real channel in rural India) + SMS fallback; email/push interfaces stubbed
- Property-aware messaging — thread carries parcel context. **Start with async messaging, not realtime.** WebSockets, typing indicators and read receipts are Phase 3 polish; nobody abandons a land lease over a missing typing indicator

---

## Phase 3 — Discovery (Months 8–14)

**Gate to enter: ≥300 real parcels in the base district.** Not before. A map with 40 pins is an advertisement for emptiness.

This is where the master prompt's Sections 3, 5, 8 and 27 finally get built in full:

- Map-first discovery: **real polygons, never bare pins**; satellite + terrain; hover/select/highlight; area display
- **Viewport-bounded fetching** via PostGIS `ST_Intersects` on the viewport envelope + geometry simplification by zoom (`ST_SimplifyPreserveTopology`) + server-side clustering beyond a threshold. Never ship the whole layer to the browser
- Radius search: 5 / 10 / 20 / 50 km from GPS or geocoded point
- Filters: acreage, rent, crop suitability, soil, irrigation, water source, electricity, road access, lease duration, availability, verification status
- Saved searches, saved parcels, compare
- Desktop: map + panel. Mobile: map ↔ list toggle with bottom sheets
- Dark mode, skeletons, and the full loading/empty/error/success state matrix from master prompt §28
- **PWA before native apps.** A native app is a distribution decision, not a product decision; defer until retention justifies it

---

## Phase 4 — Intelligence (Months 12–24) · *Only when the data is real*

Every AI module in the master prompt is excellent — **and every one of them is a liability if shipped on invented data.** An AI price estimate built from nothing is exactly the "fabricated verification" the master prompt forbids, wearing a different hat.

| Module | Honest precondition |
|---|---|
| **Price Recommendation** | ≥50 real transacted leases in the district. Until then show *"Comparable leases: 3 nearby, ₹12k–₹18k/acre"* — a fact, not a model |
| **Match Score** | Only once explainable inputs exist; always show the breakdown (Location 92 · Water 95 · Price 91), never a bare number |
| **Crop Recommendation** | Wire `WeatherConnector` + soil data first; label confidence; always show reasoning |
| **Satellite Intelligence** | `SatelliteConnector`, ISRO/Bhuvan-first per the brand's standing pillar, Sentinel-2 as the practical open fallback. Start with NDVI/vegetation and change detection |
| **AI Boundary Detection** | Last. Always labelled **"AI-suggested boundary"**, always requiring human confirmation before it becomes `parcel.geometry` |
| **Mandi Price module** | Sourced via `MandiPriceConnector` (Agmarknet-style). **Always stamp source + last-updated.** Never present stale prices as live |
| **Natural-language search** | Convert intent → structured params. Genuinely useful for a Hindi-speaking user; ship *after* structured search works |

**Rule for the entire phase:** *a number FarmKaro cannot explain is a number FarmKaro does not display.*

---

## 5.5 The verification ladder (build in Phase 1, never compromise)

Replace the binary "Verified ✓" with visible, specific, honest states. This is a **brand asset**, not a compliance chore — publish the ladder publicly and explain each rung.

**Owner identity**
`unverified` → `id_submitted` → `id_checked_by_farmkaro`

**Land documents**
`none` → `uploaded` → `under_review` → `reviewed_by_farmkaro`
*(Label everywhere: "Reviewed by FarmKaro. This is not a government verification of title.")*

**Parcel geometry**
`declared` → `gps_captured` → `boundary_drawn` → `boundary_walked_by_farmkaro` → `matched_to_cadastral_record`

**Lease history**
Real completed leases only. Zero is displayed as zero.

**Reviews**
Post-completion only, both directions, and only between parties to an actual executed lease.

**Never rendered:** a green tick with no state behind it; the words "government verified"; a fabricated review, lease or rating; a match score without its breakdown; the word "escrow" before escrow exists.

---

## 5.6 The 18-month "do not build" list

Photo-editing suites · a native mobile app · in-house payment wallet · in-house eSign · crop-sale marketplace · IoT/drone integrations · fractional ownership · a lending product · a national map · multi-language beyond **Hindi + English** · blockchain anything · a chatbot that answers land-legal questions unsupervised · anything requiring a scraped government portal.
