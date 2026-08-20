# FarmKaro

**Making it safe to lease out farmland — and making leased-in land bankable.**

FarmKaro is a farmland leasing platform for India, built parcel-first on PostgreSQL + PostGIS.
This repository currently holds the **v2 relaunch plan**: a post-mortem of the first attempt,
sourced market and legal research, the product and technical architecture, and a
week-by-week execution plan.

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

> ⚠️ The legal analysis in `docs/02` is research, not legal advice. Every point marked
> **[VERIFY LOCALLY]** must be confirmed with a practising revenue advocate in the
> relevant state before it drives a product or business decision.
