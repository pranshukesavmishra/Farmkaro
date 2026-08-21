/**
 * LandRecordsConnector — consent-based, single-parcel land record lookup.
 *
 * DESIGN CONSTRAINT, deliberate and load-bearing:
 * this connector can only ever fetch ONE parcel that the requesting user has
 * asserted is theirs. There is no bulk export, no enumeration, and no
 * owner-name search. Two reasons:
 *
 *  1. Legal. A statewide, searchable "name / father's name -> land holdings"
 *     index is mass processing of personal data. India's DPDP Act 2023 came
 *     into force in stages from 13 Nov 2025 (full effect 13 May 2027) and
 *     requires a lawful basis and consent for exactly this kind of processing;
 *     penalties reach Rs 250 crore. Bulk scraping also breaches the source
 *     portals' terms.
 *  2. Safety. Such an index is a ready-made targeting tool for land fraud
 *     against absentee, elderly and women owners - the precise harm FarmKaro
 *     exists to reduce.
 *
 * What IS legitimate, and is what this implements: an owner (or a FarmKaro
 * field executive sitting with them) supplies their own khasra/khatauni
 * number, and we retrieve that single record to pre-fill the listing and,
 * where available, the surveyed boundary geometry.
 *
 * Providers are pluggable. `operator_entered` is the default and always
 * available. An authorised provider (a state land-records API under an MoU,
 * or MP's WebGIS 2.0 where terms permit) can be dropped in without touching
 * any call site, and only it may report isAuthoritative = true.
 */
import type { PolygonCoords } from "@/lib/geo";

/**
 * A lookup is addressed by ONE self-asserted identifier:
 *
 *  - `khasraNumber` — the plot number, within a named village; or
 *  - `bhuswamiId`   — the owner's own Bhu-Swami (landholder) ID, which
 *                     returns every parcel held under it, so the owner can
 *                     simply pick the one they want to lease.
 *
 * Both are things the owner already knows about themselves, which is why they
 * are consent-compatible. Neither allows looking up a *different* person:
 * there is deliberately no name, father's-name or address field here, and a
 * test asserts this key set so adding one trips CI.
 */
export interface LandRecordQuery {
  state: string;
  district: string;
  tehsil?: string;
  /** Required with khasraNumber; optional with bhuswamiId. */
  village?: string;
  khasraNumber?: string;
  /** MP Bhu-Swami (landholder) ID — the owner's own record identifier. */
  bhuswamiId?: string;
  /** Explicit, recorded consent from the person the record belongs to. */
  consent: {
    /** Who authorised this lookup (the FarmKaro user id). */
    grantedByUserId: string;
    /** What they attested, verbatim, in the UI. */
    statement: string;
    grantedAt: string;
  };
}

/** One parcel as returned by a land-records source. */
export interface LandParcelRecord {
  khasraNumber?: string;
  village?: string;
  /** Surveyed boundary, when the provider supplies geometry. */
  geometry?: PolygonCoords;
  areaAcres?: number;
  /** Owner name as printed on the record; shown back only to the requester. */
  recordedOwnerName?: string;
  khataNumber?: string;
  ulpin?: string;
  /** Anything else the provider returned, displayed verbatim and unparsed. */
  raw?: Record<string, unknown>;
}

export interface LandRecordResult {
  found: boolean;
  provider: LandRecordsProviderId;
  /** Only an authorised government integration may set this true. */
  isAuthoritative: boolean;
  /** 0..n parcels. A khasra lookup yields at most one; a Bhu-Swami ID may
   *  yield several, and the owner chooses which to list. */
  parcels: LandParcelRecord[];
  /** Human-readable note rendered in the UI (e.g. why nothing was found). */
  note?: string;
}

export type LandRecordsProviderId =
  | "operator_entered"
  | "mp_webgis"
  | "bhu_naksha"
  | "dilrmp";

export interface LandRecordsProvider {
  readonly id: LandRecordsProviderId;
  readonly label: string;
  /** False for anything not backed by an authorised government integration. */
  readonly isAuthoritative: boolean;
  /** True only where we hold written permission to query the source. */
  readonly isConfigured: boolean;
  lookup(q: LandRecordQuery): Promise<LandRecordResult>;
}

/**
 * Default provider: nothing is fetched from a third party. The record details
 * are whatever the owner/field executive typed from the paper document in
 * front of them, and the result is explicitly non-authoritative.
 */
export const operatorEnteredProvider: LandRecordsProvider = {
  id: "operator_entered",
  label: "Entered from the owner's document",
  isAuthoritative: false,
  isConfigured: true,
  async lookup(q) {
    return {
      found: false,
      provider: "operator_entered",
      isAuthoritative: false,
      parcels: [],
      note:
        `No connected land-records source for ${q.state}. Details are recorded ` +
        `as supplied by the owner and are marked owner-supplied, not verified.`,
    };
  },
};

/**
 * Placeholder for an authorised state integration.
 *
 * Deliberately inert until BOTH a base URL and an access token are configured,
 * which in practice means an MoU/API agreement is in place. It will never
 * scrape an HTML portal: it speaks to a documented endpoint or it does nothing.
 */
export function authorisedStateProvider(): LandRecordsProvider | null {
  const baseUrl = process.env.LAND_RECORDS_API_URL;
  const token = process.env.LAND_RECORDS_API_TOKEN;
  const id = (process.env.LAND_RECORDS_PROVIDER as LandRecordsProviderId) ?? "mp_webgis";
  if (!baseUrl || !token) return null;

  return {
    id,
    label: process.env.LAND_RECORDS_PROVIDER_LABEL ?? "State land records (authorised)",
    isAuthoritative: true,
    isConfigured: true,
    async lookup(q) {
      // Bhu-Swami ID resolves to the holder's parcels; khasra resolves to one.
      const path = q.bhuswamiId ? "/holdings" : "/parcel";
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          state: q.state,
          district: q.district,
          tehsil: q.tehsil,
          village: q.village,
          khasra: q.khasraNumber,
          bhuswami_id: q.bhuswamiId,
        }),
      });
      if (!res.ok) {
        return {
          found: false,
          provider: id,
          isAuthoritative: true,
          parcels: [],
          note: `Land-records service returned ${res.status}.`,
        };
      }

      type Row = {
        khasra?: string;
        village?: string;
        geometry?: PolygonCoords;
        area_acres?: number;
        owner_name?: string;
        khata?: string;
        ulpin?: string;
      };
      const data = (await res.json()) as Row | { parcels?: Row[] };
      const rows: Row[] = Array.isArray((data as { parcels?: Row[] }).parcels)
        ? ((data as { parcels?: Row[] }).parcels as Row[])
        : [data as Row];

      const parcels: LandParcelRecord[] = rows
        .filter((row) => row && (row.geometry || row.owner_name || row.khasra))
        .map((row) => ({
          khasraNumber: row.khasra,
          village: row.village ?? q.village,
          geometry: row.geometry,
          areaAcres: row.area_acres,
          recordedOwnerName: row.owner_name,
          khataNumber: row.khata,
          ulpin: row.ulpin,
          raw: row as Record<string, unknown>,
        }));

      return { found: parcels.length > 0, provider: id, isAuthoritative: true, parcels };
    },
  };
}

export function getLandRecordsProvider(): LandRecordsProvider {
  return authorisedStateProvider() ?? operatorEnteredProvider;
}

/**
 * The single entry point. Requires consent, and records every lookup so there
 * is an auditable answer to "who looked up what, and on whose authority".
 */
export async function lookupLandRecord(
  q: LandRecordQuery,
  onAudit?: (entry: {
    provider: string;
    isAuthoritative: boolean;
    found: boolean;
    identifier: string;
    identifierKind: "khasra" | "bhuswami";
    village?: string;
  }) => void,
): Promise<LandRecordResult> {
  if (!q.consent?.grantedByUserId || !q.consent?.statement) {
    throw new Error("A land-record lookup requires recorded consent.");
  }

  const hasKhasra = Boolean(q.khasraNumber?.trim());
  const hasBhuswami = Boolean(q.bhuswamiId?.trim());
  if (hasKhasra === hasBhuswami) {
    throw new Error("Provide exactly one identifier: a khasra number or a Bhu-Swami ID.");
  }
  if (hasKhasra && !q.village?.trim()) {
    throw new Error("A khasra lookup needs the village it belongs to.");
  }

  const provider = getLandRecordsProvider();
  const result = await provider.lookup(q);
  onAudit?.({
    provider: provider.id,
    isAuthoritative: provider.isAuthoritative,
    found: result.found,
    identifier: (hasBhuswami ? q.bhuswamiId : q.khasraNumber) as string,
    identifierKind: hasBhuswami ? "bhuswami" : "khasra",
    village: q.village,
  });
  return result;
}
