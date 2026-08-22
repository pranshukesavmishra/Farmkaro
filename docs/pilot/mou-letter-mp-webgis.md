# Draft: Data-access request to the Commissioner, Land Records & Settlement, MP

> **Status: DRAFT for founder review.** Fill every `[FILL: …]` before sending. Verify the
> current officeholder's name and the office address on https://landrecords.mp.gov.in before
> despatch. Send by registered post AND email, and keep proof of both. This letter asks only
> for what the platform is already built to consume (`docs/11`, Route 3): the connector goes
> live with credentials and no code change.

---

**प्रेषक / From:**
[FILL: Founder name], Founder
FarmKaro ([FILL: registered legal entity name])
[FILL: registered office address, Jabalpur, MP]
CIN/Udyam: [FILL] · Email: [FILL] · Mobile: [FILL]

**सेवा में / To:**
आयुक्त, भू-अभिलेख एवं बंदोबस्त / The Commissioner, Land Records & Settlement
Government of Madhya Pradesh, Gwalior (M.P.)

**दिनांक / Date:** [FILL]

**विषय: कृषि भूमि लीज़िंग प्लेटफ़ॉर्म हेतु MP Bhulekh / WebGIS 2.0 से सहमति-आधारित भू-अभिलेख API एक्सेस के लिए अनुरोध**
**Subject: Request for consent-based land-records API access (MP Bhulekh / WebGIS 2.0) for an agricultural land-leasing platform — Jabalpur pilot**

महोदय / Respected Sir/Madam,

**1. Who we are.** FarmKaro is a Jabalpur-based agricultural land-leasing platform. Our
purpose is to make it safe for landowners to lease out idle farmland under the state
land-leasing framework — leases with a fixed term and end date that create no tenancy or
occupancy rights — and to make leased-in land bankable for cultivators. We are currently
running a pilot in Jabalpur district.

**2. What we request.** Read-only, owner-consented access to land-record data through MP
Bhulekh / WebGIS 2.0, specifically:

1. **Per-parcel khasra/khatauni lookup** — one record, addressed by khasra number + village,
   returned only against a recorded owner consent;
2. **Holdings by Bhu-Swami ID** — the parcels held under a landholder's own ID, so an owner
   can identify their land without khasra/khata confusion;
3. **Parcel geometry (Bhu-Naksha)** by khasra, so a listed parcel's true boundary can be
   shown instead of an approximation;
4. **The permitted-use and fee terms** applicable to such access for a private platform.

**3. What we commit to.** Our platform is already engineered around these commitments, and
we invite technical scrutiny of it:

- **Consent first.** Every lookup requires the owner's recorded attestation, shown verbatim
  and stored with the audit entry. There is deliberately **no search by any person's name**
  and no bulk retrieval; a khata number alone resolves nothing.
- **No scraping, ever.** Our integration layer speaks only to documented endpoints under an
  executed agreement; absent credentials it does nothing. We have declined to scrape public
  portals as a matter of policy.
- **Honest presentation.** Data from the department is the only thing we would ever mark
  authoritative; owner-supplied details are permanently labelled as such, and we never
  represent any document as government-verified unless it is.
- **DPDP Act 2023 discipline**: purpose-limited use (verification of a parcel the owner is
  listing), no onward disclosure, deletion on withdrawal of consent, and a complete audit
  trail of every access.

**4. What the state gains.** Every lease we conclude is executed under the state framework
and registered — converting informal, unrecorded tenancies into recorded, revenue-visible
instruments, on top of the digitised records the department has already built.

We request an appointment with your office, or with the officer you designate, to present
the platform and discuss terms. We are happy to execute an MoU/NDA in the department's
format and to demonstrate the consent and audit machinery end to end.

सधन्यवाद / With respectful thanks,

[FILL: signature]
[FILL: Founder name], Founder — FarmKaro

**संलग्न / Enclosures:**
1. Company registration certificate [FILL]
2. One-page platform note (print of `docs/00-executive-summary.md`)
3. Technical note on the consent-gated connector (print of `docs/11-land-records-integration.md`, §11.3)

---

## Despatch checklist

- [ ] Verify current Commissioner's name + office address (landrecords.mp.gov.in)
- [ ] Consider a parallel copy to the **Collector, Jabalpur** (the pilot district) with a
      covering line — district endorsement helps the Gwalior file move
- [ ] Registered post + email; retain both receipts
- [ ] Diary a follow-up call at 3 weeks; a second letter at 6 weeks referencing the first
