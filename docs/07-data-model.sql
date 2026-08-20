-- =============================================================================
-- FarmKaro v2 — Core schema (PostgreSQL 16 + PostGIS 3.4)
-- Phase 1 slice: identity, parcels, documents, verification, listings.
-- Phase 2 tables (engagement, leasing, payments) included as the target shape.
-- Design notes:
--   * The PARCEL is the core object. A listing presents a parcel; a lease is an
--     agreement over a parcel. Geometry never lives on a listing.
--   * Verification states are explicit and honest. There is no boolean `verified`.
--   * ULPIN / Farmer Registry IDs are first-class nullable columns so FarmKaro
--     joins to the national land substrate without a later migration.
--   * Soft deletion via deleted_at; audit_logs is append-only.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- enums ------------------------------------------------------------

CREATE TYPE user_role            AS ENUM ('owner','lessee','ops','admin');
CREATE TYPE identity_status      AS ENUM ('unverified','id_submitted','id_checked_by_farmkaro');
CREATE TYPE document_status      AS ENUM ('uploaded','under_review','reviewed_by_farmkaro','rejected');
CREATE TYPE geometry_status      AS ENUM ('declared','gps_captured','boundary_drawn',
                                          'boundary_walked_by_farmkaro','matched_to_cadastral_record');
CREATE TYPE boundary_source      AS ENUM ('owner_drawn','gps_walk','geojson_import',
                                          'cadastral_import','ai_suggested');
CREATE TYPE listing_status       AS ENUM ('draft','pending_review','active','paused','leased','archived');
CREATE TYPE enquiry_status       AS ENUM ('new','responded','visit_requested','visit_done','closed');
CREATE TYPE offer_status         AS ENUM ('open','countered','accepted','rejected','withdrawn','expired');
CREATE TYPE lease_status         AS ENUM ('draft','terms_agreed','agreement_generated','partially_signed',
                                          'signed','active','expiring','completed','terminated','disputed');
CREATE TYPE registration_status  AS ENUM ('unregistered','stamped','submitted_for_registration','registered');
CREATE TYPE payment_status       AS ENUM ('pending','processing','succeeded','failed','refunded','disputed');
CREATE TYPE water_source         AS ENUM ('borewell','canal','river','pond','well','rainfed','other');
CREATE TYPE road_access_type     AS ENUM ('none','kutcha','pucca','highway');

-- ---------- identity ---------------------------------------------------------

CREATE TABLE users (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone                 varchar(15)  NOT NULL UNIQUE,   -- E.164
    email                 varchar(255) UNIQUE,
    full_name             varchar(200),
    preferred_language    varchar(8)   NOT NULL DEFAULT 'hi',
    roles                 user_role[]  NOT NULL DEFAULT '{owner}',
    identity_status       identity_status NOT NULL DEFAULT 'unverified',
    -- Never store a full Aadhaar number. Store only the ASP/ESP reference token.
    identity_ref_token    varchar(128),
    farmer_registry_id    varchar(20),                    -- AgriStack 11-digit Farmer ID, if the user has one
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz
);
CREATE INDEX idx_users_phone ON users (phone) WHERE deleted_at IS NULL;

-- ---------- geography --------------------------------------------------------

CREATE TABLE villages (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    state       varchar(80)  NOT NULL,
    district    varchar(80)  NOT NULL,
    tehsil      varchar(80),
    block       varchar(80),
    name        varchar(120) NOT NULL,
    lgd_code    varchar(20),                              -- Local Government Directory code
    centroid    geometry(Point, 4326),
    UNIQUE (state, district, tehsil, name)
);
CREATE INDEX idx_villages_centroid ON villages USING GIST (centroid);
CREATE INDEX idx_villages_name_trgm ON villages USING GIN (name gin_trgm_ops);

-- ---------- the core object --------------------------------------------------

CREATE TABLE land_parcels (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id            uuid NOT NULL REFERENCES users(id),
    village_id          uuid REFERENCES villages(id),

    -- Geometry: WGS84, always MultiPolygon. Area computed on the geography cast,
    -- NEVER as planar area in degrees.
    geometry            geometry(MultiPolygon, 4326),
    centroid            geometry(Point, 4326)
                        GENERATED ALWAYS AS (ST_Centroid(geometry)) STORED,
    area_sq_m           numeric(14,2),
    area_acres          numeric(12,4)
                        GENERATED ALWAYS AS (area_sq_m / 4046.8564224) STORED,
    perimeter_m         numeric(12,2),
    declared_area_acres numeric(12,4),                    -- what the owner says; may differ from computed
    area_variance_pct   numeric(6,2),                     -- >15% ⇒ ops review queue

    -- Revenue-record identifiers
    khasra_number       varchar(60),
    khata_number        varchar(60),
    ulpin               varchar(20),                      -- 14-digit Bhu-Aadhaar, when known
    survey_number       varchar(60),

    -- Denormalised admin fields for fast filtering
    state               varchar(80),
    district            varchar(80),
    tehsil              varchar(80),
    village_name        varchar(120),

    -- Honest status, never a boolean
    geometry_status     geometry_status NOT NULL DEFAULT 'declared',
    boundary_source     boundary_source,
    boundary_confirmed_by uuid REFERENCES users(id),      -- the ops person who walked it
    boundary_confirmed_at timestamptz,

    -- Attributes
    soil_type           varchar(60),
    water_sources       water_source[] NOT NULL DEFAULT '{}',
    irrigation_details  jsonb NOT NULL DEFAULT '{}',
    electricity         boolean,
    electricity_hours   smallint,
    road_access         road_access_type,
    road_distance_m     integer,
    current_usage       varchar(120),
    previous_crops      text[] NOT NULL DEFAULT '{}',
    suitable_crops      text[] NOT NULL DEFAULT '{}',
    satellite_metadata  jsonb NOT NULL DEFAULT '{}',

    notes_internal      text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,

    CONSTRAINT parcel_geometry_valid CHECK (geometry IS NULL OR ST_IsValid(geometry))
);
CREATE INDEX idx_parcels_geom      ON land_parcels USING GIST (geometry);
CREATE INDEX idx_parcels_centroid  ON land_parcels USING GIST (centroid);
CREATE INDEX idx_parcels_owner     ON land_parcels (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_parcels_admin     ON land_parcels (state, district, tehsil, village_name);
CREATE INDEX idx_parcels_ulpin     ON land_parcels (ulpin) WHERE ulpin IS NOT NULL;

-- Every boundary edit is versioned. An AI-suggested boundary is a *candidate*,
-- never silently promoted to land_parcels.geometry.
CREATE TABLE parcel_boundaries (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id      uuid NOT NULL REFERENCES land_parcels(id) ON DELETE CASCADE,
    geometry       geometry(MultiPolygon, 4326) NOT NULL,
    source         boundary_source NOT NULL,
    is_current     boolean NOT NULL DEFAULT false,
    confidence     numeric(4,3),                          -- populated for ai_suggested only
    accepted_by    uuid REFERENCES users(id),             -- human confirmation is mandatory
    accepted_at    timestamptz,
    created_by     uuid REFERENCES users(id),
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_boundaries_parcel ON parcel_boundaries (parcel_id, is_current);

CREATE TABLE parcel_media (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id     uuid NOT NULL REFERENCES land_parcels(id) ON DELETE CASCADE,
    kind          varchar(20) NOT NULL,                   -- photo | video | satellite
    storage_key   text NOT NULL,                          -- land/{parcel_id}/photos/...
    variants      jsonb NOT NULL DEFAULT '{}',            -- responsive/thumbnail keys
    captured_at   timestamptz,
    capture_point geometry(Point, 4326),                  -- where the photo was taken
    is_public     boolean NOT NULL DEFAULT true,
    sort_order    smallint NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_parcel ON parcel_media (parcel_id, sort_order);

-- Documents are ALWAYS private. Access is by policy, never by URL possession.
CREATE TABLE parcel_documents (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id       uuid NOT NULL REFERENCES land_parcels(id) ON DELETE CASCADE,
    uploaded_by     uuid NOT NULL REFERENCES users(id),
    doc_type        varchar(40) NOT NULL,                 -- khasra | khatauni | ownership | id | other
    storage_key     text NOT NULL,
    original_name   varchar(255),
    mime_type       varchar(100),
    size_bytes      bigint,
    checksum_sha256 varchar(64),
    status          document_status NOT NULL DEFAULT 'uploaded',
    reviewed_by     uuid REFERENCES users(id),
    reviewed_at     timestamptz,
    review_notes    text,
    malware_scan    varchar(20) NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);
CREATE INDEX idx_docs_parcel ON parcel_documents (parcel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_queue  ON parcel_documents (status) WHERE status = 'under_review';

-- Evidence chain: who checked what, when, and on what basis.
CREATE TABLE verification_records (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_type   varchar(30) NOT NULL,                  -- user | parcel | document | lease
    subject_id     uuid NOT NULL,
    check_type     varchar(50) NOT NULL,                  -- identity | document_review | field_visit | cadastral_match
    outcome        varchar(30) NOT NULL,                  -- passed | failed | inconclusive
    -- Honesty flag: a FarmKaro review is NEVER a government verification.
    is_government_verification boolean NOT NULL DEFAULT false,
    evidence       jsonb NOT NULL DEFAULT '{}',
    performed_by   uuid REFERENCES users(id),
    performed_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_false_govt_claim CHECK (is_government_verification = false)
    -- ^ Drop this constraint only when an actual authorised government
    --   integration exists. It is here to make fabrication a schema error.
);
CREATE INDEX idx_verif_subject ON verification_records (subject_type, subject_id);

-- ---------- listings ---------------------------------------------------------

CREATE TABLE listings (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id           uuid NOT NULL REFERENCES land_parcels(id),
    owner_id            uuid NOT NULL REFERENCES users(id),
    status              listing_status NOT NULL DEFAULT 'draft',
    title               varchar(200),
    description         text,
    rent_annual         numeric(12,2),
    rent_per_acre       numeric(12,2),
    deposit             numeric(12,2),
    lease_min_years     numeric(4,1),
    lease_max_years     numeric(4,1),
    available_from      date,
    crop_restrictions   text[] NOT NULL DEFAULT '{}',
    preferred_crops     text[] NOT NULL DEFAULT '{}',
    organic_only        boolean NOT NULL DEFAULT false,
    published_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);
CREATE INDEX idx_listings_active ON listings (status, rent_annual) WHERE status = 'active';
CREATE INDEX idx_listings_parcel ON listings (parcel_id);

-- ---------- engagement (Phase 2) --------------------------------------------

CREATE TABLE enquiries (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id  uuid NOT NULL REFERENCES listings(id),
    lessee_id   uuid NOT NULL REFERENCES users(id),
    status      enquiry_status NOT NULL DEFAULT 'new',
    message     text,
    visit_at    timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_enquiries_listing ON enquiries (listing_id, status);

CREATE TABLE offers (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id      uuid NOT NULL REFERENCES listings(id),
    lessee_id       uuid NOT NULL REFERENCES users(id),
    parent_offer_id uuid REFERENCES offers(id),           -- counter-offer chain
    status          offer_status NOT NULL DEFAULT 'open',
    rent_annual     numeric(12,2) NOT NULL,
    deposit         numeric(12,2),
    lease_years     numeric(4,1) NOT NULL,
    start_date      date,
    terms_note      text,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_offers_listing ON offers (listing_id, status);

CREATE TABLE conversations (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id   uuid REFERENCES land_parcels(id),
    listing_id  uuid REFERENCES listings(id),             -- conversations are parcel-aware by design
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id),
    last_read_at    timestamptz,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid REFERENCES users(id),            -- NULL ⇒ system event
    body            text,
    attachment_key  text,
    system_event    varchar(50),                          -- offer_made | visit_scheduled | lease_signed
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_convo ON messages (conversation_id, created_at DESC);

-- ---------- leasing (Phase 2) ------------------------------------------------

CREATE TABLE leases (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id             uuid NOT NULL REFERENCES land_parcels(id),
    listing_id            uuid REFERENCES listings(id),
    accepted_offer_id     uuid REFERENCES offers(id),
    status                lease_status NOT NULL DEFAULT 'draft',

    start_date            date,
    end_date              date,
    rent_annual           numeric(12,2) NOT NULL,
    deposit               numeric(12,2),
    payment_frequency     varchar(20) NOT NULL DEFAULT 'annual',

    -- Legal posture is explicit, never a green tick.
    governing_act         varchar(120),   -- e.g. 'MP Agricultural Land Leasing Act'  [VERIFY LOCALLY]
    registration_status   registration_status NOT NULL DEFAULT 'unregistered',
    registration_number   varchar(80),
    registered_at         date,
    stamp_duty_paid       numeric(12,2),
    creates_tenancy_rights boolean NOT NULL DEFAULT false,  -- surfaced verbatim to the owner

    esign_envelope_id     varchar(120),
    esign_provider        varchar(40),
    signed_at             timestamptz,

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lease_dates_ordered CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);
CREATE INDEX idx_leases_parcel   ON leases (parcel_id);
CREATE INDEX idx_leases_expiring ON leases (end_date) WHERE status = 'active';

CREATE TABLE lease_parties (
    lease_id   uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users(id),
    party_role varchar(20) NOT NULL,                      -- lessor | lessee | witness | guarantor
    signed_at  timestamptz,
    PRIMARY KEY (lease_id, user_id, party_role)
);

CREATE TABLE lease_documents (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id     uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    doc_type     varchar(40) NOT NULL,                    -- draft | stamped | signed | registered_copy
    storage_key  text NOT NULL,
    version      smallint NOT NULL DEFAULT 1,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lease_events (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id    uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    event_type  varchar(50) NOT NULL,
    actor_id    uuid REFERENCES users(id),
    payload     jsonb NOT NULL DEFAULT '{}',
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lease_events ON lease_events (lease_id, occurred_at DESC);

-- ---------- payments (Phase 2) -----------------------------------------------
-- FarmKaro never holds funds. These rows RECORD movements executed by a
-- licensed Payment Aggregator. Nothing here implies escrow.

CREATE TABLE payments (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id        uuid REFERENCES leases(id),
    payer_id        uuid NOT NULL REFERENCES users(id),
    payee_id        uuid REFERENCES users(id),
    purpose         varchar(40) NOT NULL,                 -- rent | deposit | platform_fee | registration_cost
    amount          numeric(12,2) NOT NULL,
    currency        char(3) NOT NULL DEFAULT 'INR',
    due_date        date,
    status          payment_status NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_lease ON payments (lease_id, due_date);

CREATE TABLE payment_transactions (
    id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id        uuid NOT NULL REFERENCES payments(id),
    provider          varchar(30) NOT NULL,               -- razorpay | phonepe | cashfree | offline
    provider_order_id varchar(120),
    provider_ref      varchar(120),
    method            varchar(30),                        -- upi | card | netbanking | neft | cash
    amount            numeric(12,2) NOT NULL,
    status            payment_status NOT NULL,
    raw_response      jsonb NOT NULL DEFAULT '{}',
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_txn_provider_ref ON payment_transactions (provider, provider_ref)
    WHERE provider_ref IS NOT NULL;

-- ---------- reviews, notifications, AI, integrations, audit ------------------

CREATE TABLE reviews (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id     uuid NOT NULL REFERENCES leases(id),     -- reviews REQUIRE a real lease
    reviewer_id  uuid NOT NULL REFERENCES users(id),
    reviewee_id  uuid NOT NULL REFERENCES users(id),
    rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lease_id, reviewer_id, reviewee_id)
);

CREATE TABLE notifications (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES users(id),
    event_type  varchar(50) NOT NULL,
    title       varchar(200) NOT NULL,
    body        text,
    link        text,
    channels    varchar(20)[] NOT NULL DEFAULT '{in_app}',-- in_app | whatsapp | sms | email | push
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- AI output is ALWAYS stored with its inputs and explanation, or it is not stored.
CREATE TABLE ai_recommendations (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       uuid REFERENCES users(id),
    listing_id    uuid REFERENCES listings(id),
    score         numeric(5,2) NOT NULL,
    breakdown     jsonb NOT NULL,                         -- {location:92, water:95, price:91, ...}
    model_version varchar(40) NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT breakdown_not_empty CHECK (jsonb_typeof(breakdown) = 'object' AND breakdown <> '{}')
);

CREATE TABLE ai_price_estimates (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id      uuid NOT NULL REFERENCES land_parcels(id),
    low_annual     numeric(12,2) NOT NULL,
    high_annual    numeric(12,2) NOT NULL,
    method         varchar(40) NOT NULL,                  -- 'comparables' | 'model'
    comparable_count smallint NOT NULL,                   -- 0 comparables ⇒ do not display
    rationale      jsonb NOT NULL DEFAULT '{}',
    model_version  varchar(40),
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT estimate_needs_evidence CHECK (comparable_count > 0 OR method = 'model')
);

CREATE TABLE ai_crop_predictions (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id     uuid NOT NULL REFERENCES land_parcels(id),
    season        varchar(20) NOT NULL,                   -- kharif | rabi | zaid
    crop          varchar(60) NOT NULL,
    confidence    numeric(4,3) NOT NULL,
    reasoning     text NOT NULL,                          -- never optional
    model_version varchar(40),
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Every external call is logged, including the `manual` provider, so an
-- automated integration can later be measured against the human baseline.
CREATE TABLE integration_records (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector      varchar(40) NOT NULL,                  -- land_records | satellite | mandi | weather | esign | payment
    provider       varchar(40) NOT NULL,                  -- 'manual' is a legitimate provider
    subject_type   varchar(30),
    subject_id     uuid,
    request        jsonb NOT NULL DEFAULT '{}',
    response       jsonb NOT NULL DEFAULT '{}',
    status         varchar(20) NOT NULL,
    latency_ms     integer,
    is_authoritative boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_subject ON integration_records (subject_type, subject_id);

CREATE TABLE audit_logs (
    id          bigserial PRIMARY KEY,
    actor_id    uuid REFERENCES users(id),
    action      varchar(80) NOT NULL,
    target_type varchar(40) NOT NULL,
    target_id   uuid,
    before      jsonb,
    after       jsonb,
    ip          inet,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs (target_type, target_id, created_at DESC);
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;   -- append-only

-- ---------- helpers ----------------------------------------------------------

-- Accurate area/perimeter on the ellipsoid. Never compute planar area in degrees.
CREATE OR REPLACE FUNCTION farmkaro_recalc_parcel_metrics() RETURNS trigger AS $$
BEGIN
    IF NEW.geometry IS NOT NULL THEN
        NEW.area_sq_m   := ST_Area(NEW.geometry::geography);
        NEW.perimeter_m := ST_Perimeter(NEW.geometry::geography);
        IF NEW.declared_area_acres IS NOT NULL AND NEW.declared_area_acres > 0 THEN
            NEW.area_variance_pct := ROUND(
                ABS((NEW.area_sq_m / 4046.8564224) - NEW.declared_area_acres)
                / NEW.declared_area_acres * 100, 2);
        END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parcel_metrics
    BEFORE INSERT OR UPDATE OF geometry, declared_area_acres ON land_parcels
    FOR EACH ROW EXECUTE FUNCTION farmkaro_recalc_parcel_metrics();
