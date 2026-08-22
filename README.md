# FarmKaro

**Making it safe to lease out farmland — and making leased-in land bankable.**

FarmKaro is a farmland leasing platform for India, built parcel-first. This repository holds
two things:

- **`docs/`** — the v2 relaunch plan: a post-mortem of the first attempt, sourced market and
  legal research, the product and technical architecture, and a week-by-week execution plan.
- **`web/`** — the working pilot platform for Jabalpur district, Madhya Pradesh.

## What the pilot platform does

- **Discover** — farmland on real satellite imagery with price pins that de-clutter
  instead of overlapping, filters that genuinely constrain the data, and honest
  verification states on every parcel.
- **Find my land (`/records`)** — a consent-gated land-record lookup by khasra + village
  or Land ID (Devanagari digits included), a khasra-copy scanner that reads the PDF and
  fills the form, and the full खतौनी record — owners and shares, area in
  hectare/acre/bigha, crops, चौहद्दी, encumbrance, mutation — pinned at the village's real
  position. Plus a 15,000-record **synthetic demonstration archive** (openly fictional,
  hence freely searchable) and a mandi price board.
- **The transaction rail** — enquiries with two-way messaging, offers with
  accept/counter/reject, a lease lifecycle with lessor-side authority on the binding
  steps, a forward-only registration ladder, notifications, and an append-only audit
  log. All behind phone + OTP auth with hashed session tokens and rate limiting.

## Run the web app

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

**No API keys required — for anything.** The map is a true hybrid view built
from keyless open services: real satellite imagery, place labels and roads
(Esri), plus place search (OpenStreetMap Nominatim). Data starts as a
clearly-labelled sample set for the Jabalpur pilot district, stored in a local
SQLite database that is created on first run.

A Google Maps key is optional: set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and the
discovery map switches to Google satellite with the same pins and boundaries.
See `web/.env.example` for every optional switch.

## Start here

📄 **[`docs/00-executive-summary.md`](docs/00-executive-summary.md)**

## Contents

| Doc | Contents |
|---|---|
| [`docs/00-executive-summary.md`](docs/00-executive-summary.md) | The five decisions that define v2 |
| [`docs/01-postmortem-v1.md`](docs/01-postmortem-v1.md) | What v1 was and the nine failure modes |
| [`docs/02-market-legal-research.md`](docs/02-market-legal-research.md) | Tenancy law, state Acts, ULPIN/AgriStack, SEBI/CIS, honest TAM |
| [`docs/03-strategy-v2.md`](docs/03-strategy-v2.md) | The reframe, the wedge, the three defensible assets |
| [`docs/04-business-model.md`](docs/04-business-model.md) | Revenue lines, unit economics, funding posture |
| [`docs/05-product-roadmap.md`](docs/05-product-roadmap.md) | Phases 0–4 with numeric gates |
| [`docs/06-technical-architecture.md`](docs/06-technical-architecture.md) | Stack, modules, connectors, PostGIS, security |
| [`docs/07-data-model.sql`](docs/07-data-model.sql) | PostGIS schema |
| [`docs/08-gtm-first-180-days.md`](docs/08-gtm-first-180-days.md) | Week-by-week plan |
| [`docs/09-metrics-and-kill-criteria.md`](docs/09-metrics-and-kill-criteria.md) | Metrics and pre-agreed kill criteria |
| [`docs/10-risk-register.md`](docs/10-risk-register.md) | Ranked risks and mitigations |
| [`docs/11-land-records-integration.md`](docs/11-land-records-integration.md) | MP Bhulekh / land-records integration strategy |
| [`docs/pilot/`](docs/pilot/) | Pilot operations pack: MoU request letter (MP WebGIS), field-executive onboarding checklist, revenue-advocate brief |

## Non-negotiable product rules

1. The **land parcel** is the core object — a listing merely presents it.
2. **PostGIS** is the geographic source of truth. Polygons, never bare pins.
3. **Document uploaded ≠ document verified.** The two are separate states, always.
4. **Never claim government verification.** Enforced by a `CHECK` constraint, not a code review.
5. **AI output is suggestion, never authority** — and never displayed without its evidence.
6. Payments run through a **licensed aggregator** behind an abstraction. FarmKaro never holds funds.
7. **"Escrow" does not appear in the UI** until a regulated arrangement is genuinely live.
8. **No pooled investment or fractional-ownership product.** Unregistered-CIS risk.
9. Government and state integrations stay behind **connectors**, with `manual` as the default provider.
10. Ship in **Hindi first**.

## Verification

`cd web && npm test` runs 93 unit tests. The browser-driven suite goes further:

```bash
cd web
bash scripts/reset-dev.sh   # fresh database + dev server
npm run verify:all          # 13 checks: flows, leases, messaging, records,
                            # concurrency races, WCAG contrast, mobile, and more
```

`web/scripts/README.md` documents what each check asserts — including the ones that
prove the map pin sits at the real village (recovered from the rendered tile grid) and
that parallel double-accepts resolve to exactly one winner.

> ⚠️ The legal analysis in `docs/02` is research, not legal advice. Every point marked
> **[VERIFY LOCALLY]** must be confirmed with a practising revenue advocate in the
> relevant state before it drives a product or business decision.
