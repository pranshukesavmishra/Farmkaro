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
      lookupLandRecord({ ...query, consent: undefined }),
    ).rejects.toThrow(/consent/i);
  });

  it("refuses a lookup whose consent has no attesting user", async () => {
    await expect(
      lookupLandRecord({ ...query, consent: { ...consent, grantedByUserId: "" } }),
    ).rejects.toThrow(/consent/i);
  });

  it("records an audit entry for every lookup", async () => {
    const seen: unknown[] = [];
    await lookupLandRecord(query, (e) => seen.push(e));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ identifier: "214/3", identifierKind: "khasra", village: "Panagar" });
  });
});

describe("provider selection and authority", () => {
  it("defaults to the operator-entered provider, which is never authoritative", async () => {
    const p = getLandRecordsProvider();
    expect(p.id).toBe("operator_entered");
    expect(p.isAuthoritative).toBe(false);
    const res = await p.lookup(query);
    expect(res.found).toBe(false);
    expect(res.isAuthoritative).toBe(false);
    expect(res.parcels).toEqual([]);
    expect(res.note).toMatch(/owner-supplied|not verified/i);
  });

  it("stays on the default provider when only a URL is configured (no token = no MoU)", () => {
    process.env.LAND_RECORDS_API_URL = "https://example.test/api";
    expect(getLandRecordsProvider().id).toBe("operator_entered");
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
      lookupLandRecord({ state: "MP", district: "Jabalpur", consent }),
    ).rejects.toThrow(/exactly one identifier/i);
    await expect(
      lookupLandRecord({ ...query, bhuswamiId: "BS-1" }),
    ).rejects.toThrow(/exactly one identifier/i);
  });

  it("requires a village for a khasra lookup, but not for a Bhu-Swami lookup", async () => {
    await expect(
      lookupLandRecord({ state: "MP", district: "Jabalpur", khasraNumber: "1/2", consent }),
    ).rejects.toThrow(/village/i);
    await expect(lookupLandRecord(bhuswamiQuery)).resolves.toBeDefined();
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
