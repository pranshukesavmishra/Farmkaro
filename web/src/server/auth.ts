/**
 * Authentication.
 *
 * Phone + OTP. The OTP is generated server-side, stored as a salted hash
 * with expiry and attempt limits, and delivered through an SmsConnector.
 * The default connector prints to the server console (and, outside
 * production, echoes the code in the API response marked `devOtp`) —
 * swapping in MSG91/Twilio is a one-file change, exactly like every other
 * connector in the architecture. Sessions are random 256-bit tokens stored
 * hashed, delivered as HttpOnly SameSite=Lax cookies.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db, now, uuid, audit } from "./db";
import { seedData } from "@/lib/seed";

export const SESSION_COOKIE = "fk_session";
const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type { SessionUser } from "./core";
export { AuthError } from "./core";
import { AuthError, type SessionUser } from "./core";

/* ---- SMS connector -------------------------------------------------------- */

interface SmsConnector {
  send(phone: string, text: string): Promise<void>;
  readonly provider: string;
}

const consoleSms: SmsConnector = {
  provider: "console",
  async send(phone, text) {
    console.log(`[sms:console] to=${phone} :: ${text}`);
  },
};

export const sms: SmsConnector = consoleSms;

/* ---- OTP ------------------------------------------------------------------ */

const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
  return PHONE_RE.test(digits) ? digits : null;
}

export async function requestOtp(rawPhone: string): Promise<{ ok: true; devOtp?: string } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Enter a valid 10-digit Indian mobile number." };

  // Per-phone request cap. Without this, an attacker could reset the verify
  // attempt-lock indefinitely by re-requesting a fresh code (the IP limiter
  // alone can be dodged by rotating IPs). Bucketed here, keyed by phone.
  if (!rateLimit(`otp-request-phone:${phone}`, 5, 60 * 60 * 1000))
    return { ok: false, error: "Too many code requests for this number. Try again later." };

  const code = String(randomInt(100000, 1000000));
  db()
    .prepare(
      `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,
         expires_at=excluded.expires_at, attempts=0, created_at=excluded.created_at`,
    )
    .run(phone, sha256(code), new Date(Date.now() + OTP_TTL_MS).toISOString(), now());

  await sms.send(phone, `FarmKaro login code: ${code}. Valid for 5 minutes.`);
  audit({ action: "otp_requested", targetType: "phone", targetId: phone });

  // The code is echoed only in demo mode, so the flow is fully testable
  // without an SMS provider. A production build (DEMO_ENABLED false) never
  // returns it — it is delivered by SMS alone.
  return DEMO_ENABLED ? { ok: true, devOtp: code } : { ok: true };
}

export async function verifyOtp(
  rawPhone: string,
  code: string,
  userAgent?: string,
): Promise<{ ok: true; token: string; user: SessionUser } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Invalid phone number." };

  const row = db().prepare("SELECT * FROM otp_codes WHERE phone = ?").get(phone) as
    | { code_hash: string; expires_at: string; attempts: number }
    | undefined;
  if (!row) return { ok: false, error: "Request a code first." };
  if (new Date(row.expires_at).getTime() < Date.now())
    return { ok: false, error: "Code expired — request a new one." };
  if (row.attempts >= MAX_OTP_ATTEMPTS)
    return { ok: false, error: "Too many attempts — request a new code." };

  db().prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?").run(phone);

  const a = Buffer.from(row.code_hash);
  const b = Buffer.from(sha256(code.trim()));
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, error: "Incorrect code." };

  db().prepare("DELETE FROM otp_codes WHERE phone = ?").run(phone);

  // Find or create the account. If the phone matches a sample owner's slot
  // (deterministic mapping for the pilot demo), link it so their parcels
  // appear in the owner dashboard.
  let user = db().prepare("SELECT * FROM users WHERE phone = ?").get(phone) as
    | { id: string; phone: string; full_name: string | null; roles: string; seed_owner_id: string | null }
    | undefined;

  if (!user) {
    const id = uuid();
    const t = now();
    db()
      .prepare(
        `INSERT INTO users (id, phone, full_name, roles, created_at, updated_at)
         VALUES (?, ?, NULL, '["lessee","owner"]', ?, ?)`,
      )
      .run(id, phone, t, t);
    user = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as typeof user;
    audit({ actorId: id, action: "user_created", targetType: "user", targetId: id });
  }

  const token = randomBytes(32).toString("base64url");
  db()
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(sha256(token), user!.id, new Date(Date.now() + SESSION_TTL_MS).toISOString(), now(), userAgent ?? null);

  audit({ actorId: user!.id, action: "login", targetType: "user", targetId: user!.id });

  return { ok: true, token, user: toSessionUser(user!) };
}

function toSessionUser(u: {
  id: string;
  phone: string;
  full_name: string | null;
  roles: string;
  seed_owner_id: string | null;
}): SessionUser {
  return {
    id: u.id,
    phone: u.phone,
    fullName: u.full_name,
    roles: JSON.parse(u.roles),
    seedOwnerId: u.seed_owner_id,
  };
}

/* ---- session lookup ------------------------------------------------------- */

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), now()) as Parameters<typeof toSessionUser>[0] | undefined;
  return row ? toSessionUser(row) : null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new AuthError(401, "Sign in to continue.");
  return u;
}

export function logout(token: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

/**
 * The seed-owner claim is a SANDBOX affordance, not a real onboarding path.
 * Real onboarding is the Lease Desk's identity/KYC flow (docs/05). Because
 * the claim links parcels to an account without proving ownership, it is:
 *   - available only when demo mode is on (never in production by default),
 *   - one-per-account (an account with a seed owner cannot grab another),
 *   - refused for an already-claimed owner,
 *   - rate-limited at the route.
 * This closes the "any user seizes any landowner's parcels" hole the
 * adversarial review found while keeping the demo usable.
 */
export const DEMO_ENABLED =
  process.env.FARMKARO_DEMO === "1" ||
  (process.env.NODE_ENV !== "production" && process.env.FARMKARO_DEMO !== "0");

export function claimSeedOwner(userId: string, seedOwnerId: string): { ok: boolean; error?: string } {
  if (!DEMO_ENABLED) return { ok: false, error: "Owner onboarding is handled by the FarmKaro team." };

  const owner = seedData().owners.find((o) => o.id === seedOwnerId);
  if (!owner) return { ok: false, error: "Unknown sample owner." };

  // One sandbox identity per account: prevents an attacker looping own-1..own-N
  // to sweep up every unclaimed owner.
  const me = db().prepare("SELECT seed_owner_id FROM users WHERE id = ?").get(userId) as
    | { seed_owner_id: string | null }
    | undefined;
  if (me?.seed_owner_id) {
    return me.seed_owner_id === seedOwnerId
      ? { ok: true }
      : { ok: false, error: "This account already acts as a sample owner." };
  }

  const taken = db().prepare("SELECT id FROM users WHERE seed_owner_id = ? AND id != ?").get(seedOwnerId, userId);
  if (taken) return { ok: false, error: "That sample owner is already claimed." };

  const tx = db().transaction(() => {
    db()
      .prepare("UPDATE users SET seed_owner_id = ?, full_name = COALESCE(full_name, ?), updated_at = ? WHERE id = ?")
      .run(seedOwnerId, owner.name, now(), userId);
    db().prepare("UPDATE parcels SET owner_user_id = ? WHERE seed_owner_id = ?").run(userId, seedOwnerId);
  });
  tx();
  audit({ actorId: userId, action: "seed_owner_claimed", targetType: "user", targetId: userId, detail: { seedOwnerId } });
  return { ok: true };
}

/* ---- rate limiting -------------------------------------------------------- */

const buckets = new Map<string, { tokens: number; last: number }>();

/** Token bucket: `limit` actions per `windowMs` per key. In production this
 *  moves to Redis; the call sites don't change. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const nowMs = Date.now();
  const b = buckets.get(key) ?? { tokens: limit, last: nowMs };
  b.tokens = Math.min(limit, b.tokens + ((nowMs - b.last) / windowMs) * limit);
  b.last = nowMs;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}
