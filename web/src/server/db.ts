/**
 * Persistent store — SQLite in this deployment, PostGIS in production.
 *
 * The schema deliberately mirrors docs/07-data-model.sql column-for-column
 * where SQLite allows, so the PostGIS migration is a type swap, not a
 * redesign. Geometry is stored as GeoJSON text here and as
 * geometry(MultiPolygon,4326) there; spatial predicates run through
 * src/lib/geo.ts, which implements the same geography-cast semantics.
 *
 * Honesty rules from the plan are enforced at this layer too:
 *  - verification is a ladder of explicit states, never a boolean
 *  - ai/price output requires evidence (comparables) or it is not stored
 *  - audit_logs is append-only (no UPDATE/DELETE ever issued; a trigger
 *    guards against future code doing so by accident)
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedData } from "@/lib/seed";
import { bboxOf } from "@/lib/geo";

// Resolved lazily (inside db()) rather than at module load, so a caller that
// sets FARMKARO_DB_PATH before the first db() call — notably the test suite —
// always wins the race, regardless of module import order.
function resolveDbPath(): string {
  const dir = process.env.FARMKARO_DATA_DIR ?? path.join(process.cwd(), "data");
  return process.env.FARMKARO_DB_PATH ?? path.join(dir, "farmkaro.db");
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  roles         TEXT NOT NULL DEFAULT '["lessee"]',    -- JSON array
  identity_status TEXT NOT NULL DEFAULT 'unverified',
  seed_owner_id TEXT,                                   -- link to sample owner identity
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Parcels + listings are imported from the sample dataset on first boot and
-- then owned by the database; new parcels created via the app land here too.
CREATE TABLE IF NOT EXISTS parcels (
  id            TEXT PRIMARY KEY,
  ref           TEXT NOT NULL UNIQUE,
  owner_user_id TEXT REFERENCES users(id),
  seed_owner_id TEXT,
  geometry      TEXT NOT NULL,          -- GeoJSON Polygon coordinates
  centroid_lng  REAL NOT NULL,
  centroid_lat  REAL NOT NULL,
  bbox          TEXT NOT NULL,          -- [minx,miny,maxx,maxy] JSON
  data          TEXT NOT NULL           -- full ParcelView JSON (attributes)
);
CREATE INDEX IF NOT EXISTS idx_parcels_centroid ON parcels(centroid_lng, centroid_lat);

CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  parcel_id   TEXT NOT NULL REFERENCES parcels(id),
  lessee_id   TEXT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'new',
  message     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enquiries_parcel ON enquiries(parcel_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_lessee ON enquiries(lessee_id);

CREATE TABLE IF NOT EXISTS offers (
  id              TEXT PRIMARY KEY,
  parcel_id       TEXT NOT NULL REFERENCES parcels(id),
  lessee_id       TEXT NOT NULL REFERENCES users(id),
  parent_offer_id TEXT REFERENCES offers(id),
  status          TEXT NOT NULL DEFAULT 'open',   -- open|countered|accepted|rejected|withdrawn
  rent_annual     INTEGER NOT NULL,
  deposit         INTEGER,
  lease_years     REAL NOT NULL,
  start_date      TEXT,
  note            TEXT,
  actor_role      TEXT NOT NULL DEFAULT 'lessee', -- who made THIS offer row: lessee|owner
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offers_parcel ON offers(parcel_id);
CREATE INDEX IF NOT EXISTS idx_offers_lessee ON offers(lessee_id);

CREATE TABLE IF NOT EXISTS leases (
  id                   TEXT PRIMARY KEY,
  ref                  TEXT NOT NULL UNIQUE,
  parcel_id            TEXT NOT NULL REFERENCES parcels(id),
  offer_id             TEXT REFERENCES offers(id),
  lessor_id            TEXT REFERENCES users(id),
  lessee_id            TEXT NOT NULL REFERENCES users(id),
  status               TEXT NOT NULL DEFAULT 'draft',
  -- draft -> terms_agreed -> agreement_generated -> signed -> active -> completed|terminated
  registration_status  TEXT NOT NULL DEFAULT 'unregistered',
  rent_annual          INTEGER NOT NULL,
  deposit              INTEGER,
  start_date           TEXT,
  end_date             TEXT,
  creates_tenancy_rights INTEGER NOT NULL DEFAULT 0 CHECK (creates_tenancy_rights = 0),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leases_lessee ON leases(lessee_id);
CREATE INDEX IF NOT EXISTS idx_leases_lessor ON leases(lessor_id);

CREATE TABLE IF NOT EXISTS lease_events (
  id          TEXT PRIMARY KEY,
  lease_id    TEXT NOT NULL REFERENCES leases(id),
  event_type  TEXT NOT NULL,
  actor_id    TEXT,
  payload     TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lease_events ON lease_events(lease_id, occurred_at);

CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY,
  lease_id    TEXT NOT NULL REFERENCES leases(id),
  payer_id    TEXT NOT NULL REFERENCES users(id),
  purpose     TEXT NOT NULL,             -- rent|deposit|platform_fee
  amount      INTEGER NOT NULL,
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending|recorded (no PG in sandbox)
  recorded_at TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_lease ON payments(lease_id);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  parcel_id   TEXT NOT NULL REFERENCES parcels(id),
  owner_id    TEXT,                      -- user id when the owner is a real account
  lessee_id   TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  UNIQUE (parcel_id, lessee_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_id       TEXT,                  -- NULL = system event
  body            TEXT,
  system_event    TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  event_type  TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read_at     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  detail      TEXT NOT NULL DEFAULT '{}',
  ip          TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);

-- audit_logs is append-only: reject UPDATE and DELETE at the engine level.
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
`;

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.exec(SCHEMA);
  importSeedIfEmpty(_db);
  return _db;
}

export const now = () => new Date().toISOString();
export const uuid = () => randomUUID();

/** One-time import of the sample dataset so every read path is DB-backed. */
function importSeedIfEmpty(d: Database.Database) {
  const count = (d.prepare("SELECT COUNT(*) AS n FROM parcels").get() as { n: number }).n;
  if (count > 0) return;

  const { parcels, listings, owners, comparables } = seedData();
  const listingByParcel = new Map(listings.map((l) => [l.parcelId, l]));
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  const ins = d.prepare(
    `INSERT INTO parcels (id, ref, owner_user_id, seed_owner_id, geometry, centroid_lng, centroid_lat, bbox, data)
     VALUES (@id, @ref, NULL, @seed_owner_id, @geometry, @lng, @lat, @bbox, @data)`,
  );
  const tx = d.transaction(() => {
    for (const p of parcels) {
      const listing = listingByParcel.get(p.id);
      const owner = ownerById.get(p.ownerId);
      if (!listing || !owner) continue;
      const view = {
        ...p,
        listing,
        owner,
        comparables: comparables[p.village] ?? { count: 0, lowPerAcre: 0, highPerAcre: 0 },
      };
      ins.run({
        id: p.id,
        ref: p.ref,
        seed_owner_id: p.ownerId,
        geometry: JSON.stringify(p.geometry),
        lng: p.centroid[0],
        lat: p.centroid[1],
        bbox: JSON.stringify(bboxOf(p.geometry)),
        data: JSON.stringify(view),
      });
    }
  });
  tx();
}

export function audit(entry: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
}) {
  db()
    .prepare(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.actorId ?? null,
      entry.action,
      entry.targetType,
      entry.targetId ?? null,
      JSON.stringify(entry.detail ?? {}),
      entry.ip ?? null,
      now(),
    );
}

export function notify(userId: string, n: { eventType: string; title: string; body?: string; link?: string }) {
  db()
    .prepare(
      `INSERT INTO notifications (id, user_id, event_type, title, body, link, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(uuid(), userId, n.eventType, n.title, n.body ?? null, n.link ?? null, now());
}
