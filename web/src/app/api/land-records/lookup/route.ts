import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { audit, now } from "@/server/db";
import { lookupLandRecord } from "@/server/connectors/land-records";
import { AuthError } from "@/server/core";

/**
 * Owner-initiated land record lookup.
 *
 * Addressed by ONE self-asserted identifier the owner already knows:
 *   - khasraNumber (+ village), or
 *   - bhuswamiId — their own Bhu-Swami landholder ID, which returns every
 *     parcel held under it so they can pick the one to list.
 *
 * There is intentionally no list/search endpoint beside this one, and no way
 * to query by a person's name. See src/server/connectors/land-records.ts.
 */
import { LAND_RECORD_CONSENT_STATEMENT as CONSENT_STATEMENT } from "@/lib/consent";

export const POST = route(async (req) => {
  const user = await requireSession();
  // Tight cap: a per-parcel onboarding action, never a crawl.
  await limited("land-record-lookup", 12, 60 * 60 * 1000);

  const body = await parseBody(
    req,
    z.object({
      state: z.string().trim().min(2).max(60),
      district: z.string().trim().min(2).max(60),
      tehsil: z.string().trim().max(60).optional(),
      village: z.string().trim().max(80).optional(),
      khasraNumber: z.string().trim().max(40).optional(),
      bhuswamiId: z.string().trim().max(40).optional(),
      consentGiven: z.literal(true),
    }),
  );

  try {
    const result = await lookupLandRecord(
      {
        state: body.state,
        district: body.district,
        tehsil: body.tehsil,
        village: body.village,
        khasraNumber: body.khasraNumber,
        bhuswamiId: body.bhuswamiId,
        consent: {
          grantedByUserId: user.id,
          statement: CONSENT_STATEMENT,
          grantedAt: now(),
        },
      },
      (entry) =>
        audit({
          actorId: user.id,
          action: "land_record_lookup",
          targetType: "parcel_record",
          targetId: `${entry.identifierKind}:${entry.identifier}`,
          detail: entry,
        }),
    );

    return ok({
      found: result.found,
      provider: result.provider,
      isAuthoritative: result.isAuthoritative,
      // `raw` is a provider-side passthrough with no rendering surface; it
      // never leaves the server, so an over-sharing upstream cannot leak
      // fields nobody vetted.
      parcels: result.parcels.map(({ raw: _raw, ...rest }) => rest),
      note: result.note ?? null,
      consentStatement: CONSENT_STATEMENT,
    });
  } catch (err) {
    // Only identifier/consent-shape problems are the caller's fault. Anything
    // else (a provider outage, a bug) must surface as a sanitised 500, not a
    // 400 that echoes internal detail and invites the user to "fix" it.
    const msg = (err as Error).message ?? "";
    if (/identifier|khasra|bhu-swami|consent|village/i.test(msg)) {
      throw new AuthError(400, msg);
    }
    throw err;
  }
});
