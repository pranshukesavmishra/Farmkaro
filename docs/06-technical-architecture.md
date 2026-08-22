# 06 — Technical Architecture

*Implements the master build prompt's Sections 3, 15, 16, 17, 20 — sequenced per §05, and sized for a two-founder team, not a fifty-person platform org.*

---

## 6.1 Principles

1. **The parcel is the core object.** A listing is a *presentation* of a parcel. A lease is an *agreement over* a parcel. Geometry is never derived from a listing.
2. **Modular monolith.** One deployable, hard internal domain boundaries. Not microservices — a two-person team running seven services is a two-person team doing devops instead of leases.
3. **PostGIS is the geographic source of truth.** Not a cache of some other system, not GeoJSON blobs in a text column.
4. **Every external system is a connector behind an interface**, and every connector ships with a `manual` implementation first. This is what makes "Bhulekh integration" a config change instead of a rewrite.
5. **Authorization at the resource, not the route.** Every document read is an ownership/party check.
6. **Honest states in the schema.** If the UI must distinguish "uploaded" from "reviewed," the *database* distinguishes them. Truthfulness is a data-model property.

## 6.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Framer Motion** | SSR for SEO on public parcel dossiers; one language across the stack |
| Maps | **MapLibre GL + Google Maps Platform** (satellite tiles, Geocoding, Distance Matrix) | Vector polygon rendering that Google's JS API handles poorly; Google for imagery + geocoding |
| Backend | **NestJS (TypeScript)** modular monolith | Real DI and module boundaries; enforces the domain seams |
| DB | **PostgreSQL 16 + PostGIS 3.4** | Spatial source of truth |
| ORM | **Prisma** for relational + **raw SQL for all spatial** | Prisma doesn't do PostGIS well; keep spatial queries hand-written and reviewable |
| Cache/queue | **Redis** + **BullMQ** | Caching, rate limiting, sessions, background jobs |
| Storage | **S3-compatible** (Cloudflare R2 / AWS S3) | `land/{parcel_id}/{photos\|videos\|documents\|satellite}/` — never media in Postgres |
| Auth | Phone OTP (MSG91/Twilio) + JWT w/ refresh rotation | Phone-first is the only realistic rural auth |
| eSign | **Leegality / Digio / NSDL** (licensed ASP/ESP) | Never roll your own |
| Payments | **Razorpay** behind `PaymentService` | Licensed PA; FarmKaro never holds funds |
| Messaging | **WhatsApp Business API** (primary) + SMS fallback | The actual channel in rural India |
| Hosting | Single VPS (Hetzner/DO) or Railway → AWS ap-south-1 when it matters | Do not start on Kubernetes |
| Observability | Sentry + OpenTelemetry + `pg_stat_statements` | Free-tier is fine at this scale |

**Why not Django/Rails/Go?** Any of them would work. TypeScript end-to-end is chosen because a two-person team cannot afford context-switching cost, and because it lets the same engineer move between the map and the lease state machine in one afternoon.

## 6.3 Domain modules

```
src/
├── identity/       users, profiles, roles, phone-OTP auth, KYC states
├── parcels/        parcel, geometry, boundary versions, media, documents
├── verification/   verification_records, review queues, evidence chain
├── listings/       listing, features, crops, availability, pricing
├── discovery/      spatial search, filters, radius, viewport, saved searches
├── engagement/     enquiries, offers, visits, conversations, messages
├── leasing/        lease, parties, terms, agreements, e-sign, registration status
├── payments/       PaymentService abstraction, transactions, schedules, reconciliation
├── notifications/  channel-agnostic dispatch (in-app / WhatsApp / SMS / email / push)
├── intelligence/   match scoring, price comparables, crop rec, satellite  [Phase 4]
├── integrations/   connector layer  (see 6.4)
├── admin/          ops queues, moderation, disputes, audit log viewer
└── platform/       audit, storage, jobs, rate limiting, feature flags
```

Rule: modules communicate through **published interfaces and domain events**, never by reaching into each other's tables. That's what makes a later service extraction mechanical.

## 6.4 The connector layer

```ts
// Every external dependency is one of these. Every one ships `manual` first.
interface LandRecordsConnector {
  fetchRecord(khasra: string, village: VillageRef): Promise<LandRecordResult>;
  readonly provider: 'manual' | 'mp_bhulekh' | 'up_bhulekh' | 'dilrmp';
  readonly isAuthoritative: boolean;   // false for `manual` — surfaces honestly in UI
}

interface SatelliteConnector   { getImagery(g: Geometry, d: DateRange): Promise<Tile[]>;
                                 getVegetationIndex(g: Geometry, d: DateRange): Promise<NdviSeries>; }
interface MandiPriceConnector  { getPrices(crop: string, district: string):
                                 Promise<{ prices: MandiPrice[]; source: string; fetchedAt: Date }>; }
interface WeatherConnector     { getForecast(p: Point): Promise<Forecast>; }
interface GeocodingConnector   { geocode(q: string): Promise<Place[]>;
                                 reverse(p: Point): Promise<Place>; }
interface IdentityConnector    { verify(doc: IdDoc): Promise<IdentityCheckResult>; }
interface ESignConnector       { createEnvelope(d: Doc, s: Signer[]): Promise<Envelope>; }
interface PaymentConnector     { createOrder(...): Promise<Order>;
                                 verifyWebhook(...): boolean;
                                 refund(...): Promise<Refund>; }
```

**Two rules that make this real rather than decorative:**
1. `isAuthoritative: false` on the `manual` provider is **rendered in the UI**. An operator-typed khasra number is displayed as operator-entered, not as a record lookup.
2. Every connector call is logged to `integration_records` with request/response/latency/status — so when a state API is added later, you can measure it against the manual baseline.

## 6.5 Geospatial design

**Storage**
```sql
geometry   geometry(MultiPolygon, 4326) NOT NULL   -- WGS84, always MultiPolygon
centroid   geometry(Point, 4326)                    -- generated
area_sq_m  numeric                                  -- computed via geography cast
```
Store in **4326**; compute area/length by casting to `geography` (accurate on the ellipsoid) or by transforming to a metric CRS. Do **not** compute planar area in degrees — a classic and silent error that will misreport acreage and destroy trust with a landowner who knows his land.

**Indexes**
```sql
CREATE INDEX idx_parcels_geom     ON land_parcels USING GIST (geometry);
CREATE INDEX idx_parcels_centroid ON land_parcels USING GIST (centroid);
CREATE INDEX idx_parcels_admin    ON land_parcels (state, district, tehsil, village);
```

**Viewport query** (master prompt §17 — never load everything)
```sql
SELECT p.id, p.area_acres, l.rent_annual,
       ST_AsGeoJSON(ST_SimplifyPreserveTopology(p.geometry, $tolerance)) AS geom
FROM land_parcels p
JOIN listings l ON l.parcel_id = p.id AND l.status = 'active'
WHERE p.deleted_at IS NULL
  AND p.geometry && ST_MakeEnvelope($minx,$miny,$maxx,$maxy,4326)
LIMIT 500;
```
`$tolerance` scales with zoom. Beyond 500 features, return **server-side clusters** (centroid + count), not geometry.

**Radius search** — `geography` distance, index-assisted:
```sql
WHERE ST_DWithin(p.centroid::geography, ST_MakePoint($lng,$lat)::geography, $radius_m)
```

**Boundary validation on write:** reject self-intersections (`ST_IsValid`), auto-repair with `ST_MakeValid`, warn on overlap with an existing parcel (`ST_Overlaps` — a strong signal of a duplicate or a boundary dispute, and an ops queue item), and sanity-check area against the owner's declared acreage. A >15% divergence is flagged for human review, not silently accepted.

**Caching:** viewport tiles in Redis keyed by `z/x/y + filter hash`, TTL 5 min, busted on parcel/listing write in that tile.

## 6.6 Security (master prompt §20 — non-negotiable)

- **Resource-level authorization on every document read.** Policy: a document is readable by its owner, by an `ops` reviewer, and by a counterparty **only after an offer is accepted** — never merely because someone holds the URL or guessed the ID. Enforced in a single `DocumentAccessPolicy`, unit-tested against the IDOR case explicitly.
- **Signed, short-lived (≤5 min) URLs** for private objects; bucket never public.
- Upload pipeline: extension + **magic-byte** validation, size caps, EXIF/GPS stripping on public photos, re-encode images, quarantine bucket + `MalwareScanConnector` (ClamAV to start) before promotion.
- Rate limiting in Redis per IP + per user + per phone; strict caps on OTP.
- **Audit log** on every state transition touching a parcel, document, verification, lease or payment: actor, action, target, before/after, IP, timestamp. Append-only.
- Secrets in a manager (Doppler/AWS SM) — never in `.env` in the repo.
- PII: phone/Aadhaar-adjacent fields encrypted at rest; **never store full Aadhaar numbers** — store the ASP/ESP's reference token only.
- **DPDP Act 2023** posture: purpose limitation, consent capture at intake, retention policy, deletion workflow.

## 6.7 Performance budget

| Surface | Target |
|---|---|
| Public parcel dossier LCP (4G, mid-range Android) | < 2.5 s |
| Viewport parcel query (p95) | < 250 ms |
| Radius search (p95) | < 400 ms |
| Image delivery | CDN + AVIF/WebP responsive variants |
| Map | Viewport-bounded, zoom-simplified, clustered above 500 |

Background jobs (BullMQ): image variants, document processing, notification fan-out, satellite fetch, connector sync, lease-expiry sweeps.

## 6.8 Environments & delivery

`local (docker-compose: postgis + redis + minio)` → `staging` → `production`.
GitHub Actions: typecheck → lint → unit → integration (testcontainers Postgres/PostGIS) → migration dry-run → deploy.
Migrations forward-only and reversible; **never** an unreviewed destructive migration on a table holding parcel geometry.
