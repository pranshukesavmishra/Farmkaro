# Field-executive parcel onboarding — the Lease Desk visit

> The checklist for onboarding one parcel, mapped one-to-one onto the product's
> verification states. The rule that governs everything below: **the platform never
> claims more than the field executive actually did.** A box left unticked is not a
> failure — it is simply a state the parcel honestly stays in.

## Before the visit

- [ ] Owner's wizard intake received (village, drawn boundary if any, khasra as stated)
- [ ] If a khasra copy was uploaded: scanner extraction reviewed; mismatches noted for the visit
- [ ] Pilot record set / Bhulekh lookup attempted **with the owner's recorded consent** —
      encumbrance status printed for the visit (mortgage and FRA flags below)
- [ ] Visit scheduled by phone; owner asked to keep ready: **khasra copy/khatauni, Aadhaar,
      bank passbook**, and to be present at the land itself
- [ ] Charged phone + GPS app; offline forms as backup

## At the farm — identity and papers

- [ ] Owner identified in person against photo ID; name matches the record's भू-स्वामी
      (relation line — पुत्र/पत्नी — checked, not just the name)
- [ ] **Co-owners:** every recorded shareholder identified. A 50% owner cannot lease the
      whole parcel alone — all co-owners sign, or a notarised authorisation is collected
- [ ] Khasra copy inspected **in original**; photo taken of the paper, in the owner's hands
- [ ] Product state to set: documents are **`uploaded` → `reviewed_by_farmkaro`** only for
      the papers you personally inspected. Never mark reviewed from a phone photo alone.

## At the farm — the land itself

- [ ] **GPS boundary walk:** walk the full perimeter with the owner, capture every corner.
      Product state: `gps_captured` → **`boundary_walked_by_farmkaro`**
- [ ] Boundary walked matches the owner-drawn boundary within reason; large mismatch =
      note, photograph, do NOT publish the drawn one
- [ ] चौहद्दी spot-check: the four abutting plots the record names are what you see
- [ ] Water sources seen working (borewell run, canal position); electricity hours asked of
      a neighbour too, not only the owner
- [ ] Road access driven/walked; kutcha vs pucca recorded as found, not as hoped
- [ ] 6–10 photos: each boundary direction, water source, road access, standing crop

## Red flags — stop and escalate to the Lease Desk lead

- **Mortgage recorded** (bank + amount): leasing is not barred, but terms must account for
  it and the lender may need to be informed. Escalate; never conceal it from a lessee.
- **FRA 2006 patta:** non-transferable tribal protected tenure. No listing without the
  legal check (`docs/pilot/advocate-brief.md`, Q6).
- **Dispute mentioned by anyone** (owner, neighbour, patwari): record it verbatim; parcel
  holds at its current verification state until resolved.
- **Owner cannot produce the khasra copy** or declines the consent attestation: the visit
  ends politely; nothing is listed.

## After the visit — same day

- [ ] States updated in the dashboard (geometry ladder + per-document states)
- [ ] Visit note: who was present, what was seen, what was NOT verified
- [ ] Owner told, in plain words, exactly what the listing will and will not claim
- [ ] Rent expectation discussed against the mandi board and comparables — never promised

## The two ladders (what each rung means)

| Geometry state | Set when |
|---|---|
| `owner_declared` | Owner typed an area; nobody has seen the land |
| `gps_captured` | A location exists (pin), no walked boundary |
| `boundary_walked_by_farmkaro` | **You** walked the perimeter with the owner |
| `matched_to_cadastral_record` | Boundary matches Bhu-Naksha under the data agreement — Lease Desk lead only |

| Document state | Set when |
|---|---|
| `uploaded` | A file exists. Nothing more. |
| `reviewed_by_farmkaro` | A FarmKaro person inspected the original |
| *(never)* "government-verified" | Not claimable by anyone, ever — enforced in the schema |
