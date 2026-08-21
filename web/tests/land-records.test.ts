/**
 * Land-records connector tests.
 *
 * These lock in the boundaries of the design as much as its behaviour: the
 * connector must refuse consent-less lookups, must never claim authority it
 * does not have, and must expose no way to enumerate parcels or search by
 * owner name.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as connector from "@/server/connectors/land-records";
import { getLandRecordsProvider, lookupLandRecord, operatorEnteredProvider } from "@/server/connectors/land-records";

const noAudit = () => {};

const consent = {
  grantedByUserId: "user-1",
  statement: "I confirm this land is mine.",
  grantedAt: new Date().toISOString(),
};

const query = {
  state: "Madhya Pradesh",
  district: "Jabalpur",
  village: "Panagar",
  khasraNumber: "214/3",
  consent,
};

const bhuswamiQuery = {
  state: "Madhya Pradesh",
  district: "Jabalpur",
  bhuswamiId: "BS-MP-9931245",
  consent,
};

afterEach(() => {
  delete process.env.LAND_RECORDS_API_URL;
  delete process.env.LAND_RECORDS_API_TOKEN;
  vi.unstubAllGlobals();
});

describe("consent", () => {
  it("refuses a lookup with no recorded consent", async () => {
    await expect(
      // @ts-expect-error deliberately omitting consent
      lookupLandRecord({ ...query, consent: undefined }, noAudit),
    ).rejects.toThrow(/consent/i);
  });

  it("refuses a lookup whose consent has no attesting user", async () => {
    await expect(
      lookupLandRecord({ ...query, consent: { ...consent, grantedByUserId: "" } }, noAudit),
    ).rejects.toThrow(/consent/i);
  });

  it("records an audit entry for every lookup", async () => {
    const seen: unknown[] = [];
    await lookupLandRecord(query, (e) => seen.push(e));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ identifier: "214/3", identifierKind: "khasra", village: "Panagar" });
    // The consent artifact itself is part of the audit trail, verbatim.
    expect(seen[0]).toMatchObject({
      consent: { grantedByUserId: "user-1", statement: consent.statement, grantedAt: consent.grantedAt },
    });
  });
});

describe("provider selection and authority", () => {
  it("defaults to the pilot record set, which is never authoritative", async () => {
    const p = getLandRecordsProvider();
    expect(p.id).toBe("pilot_dataset");
    expect(p.isAuthoritative).toBe(false);
    // A khasra that is not in the pilot set answers not-found, honestly.
    const res = await p.lookup(query);
    expect(res.found).toBe(false);
    expect(res.isAuthoritative).toBe(false);
    expect(res.parcels).toEqual([]);
    expect(res.note).toMatch(/pilot record set|owner-supplied|not verified/i);
  });

  it("stays on the default provider when only a URL is configured (no token = no MoU)", () => {
    process.env.LAND_RECORDS_API_URL = "https://example.test/api";
    expect(getLandRecordsProvider().id).toBe("pilot_dataset");
  });

  it("uses the authorised provider only when URL and token are both present", async () => {
    process.env.LAND_RECORDS_API_URL = "https://example.test/api";
    process.env.LAND_RECORDS_API_TOKEN = "secret";
    const p = getLandRecordsProvider();
    expect(p.isAuthoritative).toBe(true);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          geometry: [[[79.99, 23.28], [79.995, 23.28], [79.995, 23.285], [79.99, 23.28]]],
          area_acres: 4.2,
          owner_name: "Ramesh Patel",
          ulpin: "MP123456789012",
        }),
      }),
    );

    const res = await p.lookup(query);
    expect(res.found).toBe(true);
    expect(res.isAuthoritative).toBe(true);
    expect(res.parcels).toHaveLength(1);
    expect(res.parcels[0].areaAcres).toBe(4.2);
    expect(res.parcels[0].geometry?.[0]).toHaveLength(4);
  });

  it("surfaces a provider error instead of inventing a record", async () => {
    process.env.LAND_RECORDS_API_URL = "https://example.test/api";
    process.env.LAND_RECORDS_API_TOKEN = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const res = await getLandRecordsProvider().lookup(query);
    expect(res.found).toBe(false);
    expect(res.parcels).toEqual([]);
    expect(res.note).toMatch(/502/);
  });
});

describe("Bhu-Swami ID lookup", () => {
  it("requires exactly one identifier", async () => {
    await expect(
      lookupLandRecord({ state: "MP", district: "Jabalpur", consent }, noAudit),
    ).rejects.toThrow(/exactly one identifier/i);
    await expect(
      lookupLandRecord({ ...query, bhuswamiId: "BS-1" }, noAudit),
    ).rejects.toThrow(/exactly one identifier/i);
  });

  it("requires a village for a khasra lookup, but not for a Bhu-Swami lookup", async () => {
    await expect(
      lookupLandRecord({ state: "MP", district: "Jabalpur", khasraNumber: "1/2", consent }, noAudit),
    ).rejects.toThrow(/village/i);
    await expect(lookupLandRecord(bhuswamiQuery, noAudit)).resolves.toBeDefined();
  });

  it("returns every parcel held under the ID so the owner can choose", async () => {
    process.env.LAND_RECORDS_API_URL = "https://example.test/api";
    process.env.LAND_RECORDS_API_TOKEN = "secret";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        parcels: [
          { khasra: "214/3", village: "Panagar", area_acres: 4.2, owner_name: "Ramesh Patel" },
          { khasra: "77/1", village: "Belkhera", area_acres: 2.6, owner_name: "Ramesh Patel" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await getLandRecordsProvider().lookup(bhuswamiQuery);
    expect(res.found).toBe(true);
    expect(res.parcels).toHaveLength(2);
    expect(res.parcels.map((p) => p.khasraNumber)).toEqual(["214/3", "77/1"]);
    // A Bhu-Swami lookup hits the holdings endpoint, not the single-parcel one.
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/holdings$/);
  });

  it("audits the lookup as a bhuswami query", async () => {
    const seen: Array<{ identifierKind?: string; identifier?: string }> = [];
    await lookupLandRecord(bhuswamiQuery, (e) => seen.push(e));
    expect(seen[0]).toMatchObject({ identifierKind: "bhuswami", identifier: "BS-MP-9931245" });
  });
});

describe("no mass-data surface exists", () => {
  it("exports no bulk, list, search-by-name or enumeration function", () => {
    const exported = Object.keys(connector);
    const forbidden = exported.filter((k) =>
      /bulk|all|list|search|scrape|crawl|byOwner|byName|export|dump/i.test(k),
    );
    expect(forbidden).toEqual([]);
  });

  it("the query contract cannot express an owner-name search", () => {
    // A lookup is addressed by place + khasra only. If someone later adds an
    // ownerName field to LandRecordQuery, this test is the tripwire.
    const keys = Object.keys(query);
    expect(keys.sort()).toEqual(
      ["consent", "district", "khasraNumber", "state", "village"].sort(),
    );
    expect(Object.keys(bhuswamiQuery).sort()).toEqual(
      ["bhuswamiId", "consent", "district", "state"].sort(),
    );
  });

  it("the default provider returns no owner name at all", async () => {
    const res = await operatorEnteredProvider.lookup(query);
    expect(res.parcels).toEqual([]);
  });
});

describe("pilot record set", () => {
  const base = { state: "Madhya Pradesh", district: "Jabalpur", consent };

  it("finds a record by khasra + village, anchored at the village, never authoritative", async () => {
    const res = await lookupLandRecord({ ...base, village: "Panagar", khasraNumber: "104/1" }, noAudit);
    expect(res.found).toBe(true);
    expect(res.isAuthoritative).toBe(false);
    expect(res.provider).toBe("pilot_dataset");
    const [p] = res.parcels;
    expect(p.record?.landId).toBe("MP-JBL-PAN-10401");
    expect(p.khataNumber).toBe("34");
    expect(p.areaAcres).toBeCloseTo(4.55, 2);
    expect(p.record?.areaBigha).toBeCloseTo(7.28, 1);
    expect(p.record?.owners.map((o) => o.name)).toEqual(["Ramkumar Patel", "Suresh Patel"]);
    // Village-precision anchor at Panagar, and it says so.
    expect(p.location?.precision).toBe("village");
    expect(p.location?.center[0]).toBeCloseTo(79.9944, 3);
    expect(p.location?.center[1]).toBeCloseTo(23.2884, 3);
    expect(p.location?.label).toMatch(/village-level/i);
    // No fake ULPIN claim.
    expect(p.ulpin).toBeUndefined();
    expect(res.note).toMatch(/not a government-certified extract/i);
  });

  it("reads Devanagari digits and the Khas suffix", async () => {
    const res = await lookupLandRecord({
      ...base,
      village: "पनागर खास",
      khasraNumber: "१०४/१",
    }, noAudit);
    expect(res.found).toBe(true);
    expect(res.parcels[0].record?.landId).toBe("MP-JBL-PAN-10401");
  });

  it("the same khasra in the wrong village finds nothing", async () => {
    const res = await lookupLandRecord({ ...base, village: "Bargi", khasraNumber: "104/1" }, noAudit);
    expect(res.found).toBe(false);
  });

  it("finds a record by its printed Land ID, however it is typed", async () => {
    for (const id of ["MP-JBL-SIH-21502", "mp-jbl-sih-21502", "MPJBLSIH21502", "mp jbl sih 21502"]) {
      const res = await lookupLandRecord({ ...base, bhuswamiId: id }, noAudit);
      expect(res.found, id).toBe(true);
      expect(res.parcels[0].village).toBe("Gosalpur");
    }
  });

  it("refuses to resolve a bare khata number — short serials would be an enumeration oracle", async () => {
    // Khata numbers are dense 1-3 digit per-village serials. If they resolved
    // district-wide, iterating small integers would retrieve other people's
    // names, shares and loan details. They must find nothing here.
    for (const khata of ["12", "34", "41", "56", "63", "88", "104"]) {
      const res = await lookupLandRecord({ ...base, bhuswamiId: khata }, noAudit);
      expect(res.found, `khata ${khata}`).toBe(false);
    }
  });

  it("surfaces encumbrance honestly — mortgage and protected tenure included", async () => {
    const mortgaged = await lookupLandRecord({ ...base, village: "Gosalpur", khasraNumber: "215/2" }, noAudit);
    expect(mortgaged.parcels[0].record?.encumbrance.status).toBe("mortgaged");
    expect(mortgaged.parcels[0].record?.encumbrance.detail).toMatch(/Central Bank/);
    const fra = await lookupLandRecord({ ...base, village: "Baghraji", khasraNumber: "145/2" }, noAudit);
    expect(fra.parcels[0].record?.encumbrance.status).toBe("protected_tenure");
  });

  it("answers only for the pilot district — elsewhere degrades to operator-entered", async () => {
    const res = await lookupLandRecord({
      state: "Maharashtra",
      district: "Nagpur",
      village: "Panagar",
      khasraNumber: "104/1",
      consent,
    }, noAudit);
    expect(res.found).toBe(false);
    expect(res.provider).toBe("operator_entered");
  });
});
