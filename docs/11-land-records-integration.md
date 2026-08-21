# 11 — Land Records: How FarmKaro Gets Real Boundaries and Real Records

*This document answers one question: how does FarmKaro show **real** land parcels — true boundaries, true khasra details — without building something illegal, unsafe, or brand-ending?*

---

## 11.1 The request, and the honest split

The instinct is right: *"the land data of the whole state is available openly — pull it, map every parcel with its owner, and let anyone find their land by name, father's name, or khasra number."*

That request contains two very different things:

| | What it is | Verdict |
|---|---|---|
| **A.** Real cadastral **boundaries** so parcels sit correctly on satellite | Geometry | ✅ **Do it** — this is the core fix |
| **B.** Owner **looks up their own** land by khasra **or Bhu-Swami ID** and auto-fills it | Consent-based, self-identified | ✅ **Do it** — best onboarding UX in the category |
| **C.** A statewide, searchable index of **name / father's name → land holdings** | Mass personal data | ❌ **Never build** |

A and B are what actually make the product good. C is what would end the company. The rest of this document is why, and exactly how to get A and B.

## 11.2 Why C is a hard stop

**Legal.** India's **Digital Personal Data Protection Act, 2023** came into force in stages from **13 November 2025**, with full effect by **13 May 2027**. Building a searchable database keyed on a person's *name and father's name* that returns *their land holdings* is large-scale processing of personal data with no consent and no lawful basis that covers it. Penalties reach **₹250 crore**. Bulk automated extraction also breaches the source portals' terms of use — the same portals FarmKaro will later need a formal relationship with.

**Safety.** A "type a name, see their land" tool is a targeting instrument for land fraud. The people most exposed are absentee owners, widows, elderly holders and heirs in disputed successions — exactly the people FarmKaro claims to protect. Publishing that index would make the platform an accessory to the harm it says it exists to reduce.

**Commercial.** FarmKaro's single differentiator is *trust and legality* (see `docs/03-strategy-v2.md`). Being the company that scraped the revenue department destroys that positioning permanently, and forecloses the MoU route in §11.4 that leads to the genuinely authoritative data.

**The rule, in one line:** *land geometry can be public; who owns it is personal data, and it belongs to the owner to disclose, not to us to publish.*

## 11.3 What is built now (this repo)

### `LandRecordsConnector` — `web/src/server/connectors/land-records.ts`

A single, consent-gated entry point: `lookupLandRecord(query, onAudit)`.

- **Addressed by one self-asserted identifier**, never by a person:
  - `khasraNumber` (+ village) — a single plot; or
  - `bhuswamiId` — the owner's own **Bhu-Swami (landholder) ID**, which returns
    every parcel held under it so the owner simply picks the one to lease.

  Both are identifiers the owner already knows *about themselves*, which is
  exactly why they are consent-compatible: neither can address a different
  person. The query type has no `ownerName` or father's-name field, and a test
  asserts the exact key set of both query shapes, so adding one trips CI.
  Supplying both identifiers at once, or a khasra with no village, is rejected.
- **Consent is mandatory.** A lookup without a recorded attesting user throws. The verbatim statement the owner agreed to is stored with the request.
- **Every lookup is audited** to `audit_logs` (append-only) — who looked up which khasra, on whose authority, from which provider.
- **No bulk surface exists.** A test scans the module's exports and fails on anything matching `bulk|all|list|search|scrape|crawl|byOwner|byName|export|dump`.
- **Rate limited** to 12 lookups/hour per IP — enough for onboarding, useless for a crawl.
- **Authority is never faked.** `isAuthoritative` is `true` only for a provider backed by an authorised integration; the default provider reports `false` and says so in the UI.

### Providers

| Provider | When it activates | Authoritative |
|---|---|---|
| `operator_entered` (default) | Always. Details are typed from the paper document in front of the owner | ❌ No |
| `authorisedStateProvider` | Only when **both** `LAND_RECORDS_API_URL` and `LAND_RECORDS_API_TOKEN` are set — i.e. an MoU/API agreement exists | ✅ Yes |

The authorised provider speaks to a **documented JSON endpoint**. It will never parse an HTML portal: it talks to a real API or it does nothing.

### Owner-facing flow

In the listing wizard (`/list-land`, step 3) the owner has two routes:

- **"Fetch my record"** — enter the khasra number of one plot; or
- **"Fetch my land"** — enter their **Bhu-Swami ID** and get a list of every
  parcel held under it, then tap the one they want to lease. Choosing a parcel
  fills in the khasra, village, area and (where the source supplies it) the
  surveyed boundary.

With an authorised source connected this pre-fills a real boundary and area.
Without one it returns an honest note that details remain owner-supplied. This
is exactly the "owner picks their own land and everything fills in" experience
the brief asked for — sourced through the front door.

### The boundary bug this replaces

Sample parcels previously claimed `matched_to_cadastral_record` with a generated ULPIN, so the UI drew a dashed outline that did not match the field beneath it. Generated geometry now tops out at `gps_captured`, carries no ULPIN, and renders as a location pin. **A boundary is drawn only when a real one exists.**

## 11.4 How to obtain genuinely authoritative data (the real roadmap)

Ordered by how quickly each can deliver real boundaries.

### Route 1 — Owner-supplied Bhu-Naksha plot map *(available today)*
MP's Bhu-Naksha lets a citizen view and download the map of **their own** plot free of charge. During onboarding the owner (or the field executive with them) downloads their plot map/GeoJSON and imports it — the wizard already accepts GeoJSON import. Legitimate, consented, per-parcel, and it produces a **real surveyed boundary** immediately.
**Action:** add "download your Bhu-Naksha plot map" to the field-executive onboarding checklist.

### Route 2 — GPS boundary walk *(available today)*
The field executive walks the perimeter with the owner and records it. Already built (`BoundaryDrawMap`, GPS walk). This is what earns the `boundary_walked_by_farmkaro` rung and is defensible evidence in a dispute.

### Route 3 — MP WebGIS 2.0 *(the near-term prize)*
Madhya Pradesh launched **WebGIS 2.0 on 30 July 2025**, integrating cadastral boundaries with Google Maps/OpenStreetMap — the most modern state cadastral platform in the country and precisely the "modern land data" worth connecting to.
**Action:** write to the Commissioner, Land Records & Settlement, MP, requesting API/data-sharing terms for a licensed agri-leasing platform. Ask specifically for: parcel geometry by khasra, a **holdings-by-Bhu-Swami-ID endpoint** (owner-consented), a per-parcel lookup endpoint, and permitted-use terms. Set `LAND_RECORDS_PROVIDER=mp_webgis` plus URL/token and the connector goes live with no code change.

### Route 4 — DILRMP / ULPIN and AgriStack *(the national substrate)*
ULPIN ("Bhu-Aadhaar") gives every parcel a 14-digit coordinate-derived ID; AgriStack's Farmer Registry links farmer IDs to land parcel IDs. The schema already carries `ulpin` and `farmer_registry_id` as nullable columns, so joining costs nothing later.
**Action:** track state API availability; apply when the agri-platform access programme opens.

### Route 5 — Open cadastral geometry, where published without owner data
Some states publish village cadastral map layers as open data — **geometry only, no owner names**. That is bulk data FarmKaro *may* legitimately use, because it contains no personal data.
**Action:** check `data.gov.in` and the MP open-data portal for village-level cadastral layers under an open licence; import geometry only, never any owner attribute.

## 11.5 The permanent rules

1. **Never bulk-extract** from a land-records portal. Documented API or nothing.
2. **Never build owner-name search.** No `name`/`father's name` → holdings lookup, in any form, ever. A Bhu-Swami ID is acceptable *because the owner supplies their own*; it must never be paired with a name-based directory that would let someone discover another person's ID.
3. **Consent per lookup**, recorded verbatim, and audited.
4. **Owner data is shown back only to the owner** (or a party to a live transaction on that parcel), never published on a listing.
5. **`isAuthoritative` only with written permission.** A FarmKaro review is never a government verification.
6. **Draw a boundary only when a real one exists.** A location pin is honest; a wrong outline is not.
7. **Geometry may be public; ownership is personal.** When in doubt, that is the dividing line.

---

## Sources

- [Digital Personal Data Protection Act, 2023 — overview](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Act,_2023)
- [Digital Personal Data Protection Rules, 2025](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025)
- [EY — Decoding the DPDP Act 2023 and DPDP Rules 2025](https://www.ey.com/en_in/insights/cybersecurity/decoding-the-digital-personal-data-protection-act-2023)
- [Future of Privacy Forum — The DPDP Act of India, explained](https://fpf.org/blog/the-digital-personal-data-protection-act-of-india-explained/)
- [MP Bhulekh WebGIS 2.0 — Bhu Naksha, Khasra, Khatauni](https://brokersaathi.com/blogs/mp-bhulekh/)
- [Bhu Naksha MP — check Madhya Pradesh land maps online](https://www.bhulekhindia.in/bhu-naksha/bhu-naksha-mp/)
- [Bhu-Naksha — Indian cadastral mapping solution (NIC user guide)](https://bhunaksha.nic.in/bhunaksha/userguide.jsp)
- [MP Bhulekh official portal](https://mpbhulekh.gov.in/)
