/**
 * District registry tests: identifier normalisation, unit conversions, and
 * the structural integrity of the record set against the registry.
 */
import { describe, expect, it } from "vitest";
import {
  BIGHA_PER_ACRE,
  MANDI_RATES,
  REGISTRY_VILLAGES,
  TEHSILS,
  findVillage,
  hectaresToAcres,
  normalizeKhasra,
  normalizeVillage,
  tehsilOf,
} from "@/lib/district";
import { OFFICIAL_RECORDS, derivedAcres, derivedBigha } from "@/lib/official-records";

describe("identifier normalisation", () => {
  it("canonicalises khasra numbers across scripts and separators", () => {
    expect(normalizeKhasra("104/1")).toBe("104/1");
    expect(normalizeKhasra("१०४/१")).toBe("104/1");
    expect(normalizeKhasra(" 104 / 1 ")).toBe("104/1");
    expect(normalizeKhasra("104-1")).toBe("104/1");
    expect(normalizeKhasra("312")).toBe("312");
  });

  it("matches villages across scripts and the Khas suffix", () => {
    expect(normalizeVillage("Panagar Khas")).toBe("panagar");
    expect(findVillage("Panagar")?.halka).toBe("01/A");
    expect(findVillage("पनागर खास")?.name).toBe("Panagar");
    expect(findVillage("भिटौनी")?.name).toBe("Bhitoni");
    expect(findVillage("no-such-place")).toBeUndefined();
  });
});

describe("registry integrity", () => {
  it("every village belongs to a real tehsil", () => {
    for (const v of REGISTRY_VILLAGES) {
      expect(TEHSILS.some((t) => t.code === v.tehsilCode), v.name).toBe(true);
      expect(tehsilOf(v).code).toBe(v.tehsilCode);
    }
  });

  it("every centroid lies inside the Jabalpur district envelope", () => {
    for (const v of REGISTRY_VILLAGES) {
      const [lng, lat] = v.at;
      expect(lng, `${v.name} lng`).toBeGreaterThan(79.4);
      expect(lng, `${v.name} lng`).toBeLessThan(80.6);
      expect(lat, `${v.name} lat`).toBeGreaterThan(22.8);
      expect(lat, `${v.name} lat`).toBeLessThan(23.8);
    }
  });

  it("village names are unique after normalisation", () => {
    const seen = new Set(REGISTRY_VILLAGES.map((v) => normalizeVillage(v.name)));
    expect(seen.size).toBe(REGISTRY_VILLAGES.length);
  });
});

describe("units", () => {
  it("hectare -> acre uses the survey factor", () => {
    expect(hectaresToAcres(1)).toBeCloseTo(2.4710538, 6);
  });

  it("the record set's printed conversions all reproduce", () => {
    // (hectares, printed acres, printed bigha) straight from the source records.
    const printed: Array<[number, number, number]> = [
      [1.842, 4.55, 7.28],
      [2.45, 6.05, 9.68],
      [3.12, 7.71, 12.33],
      [4.8, 11.86, 18.98],
      [1.25, 3.09, 4.94],
      [2.1, 5.19, 8.3],
      [1.65, 4.08, 6.52],
    ];
    for (const [ha, ac, bigha] of printed) {
      expect(hectaresToAcres(ha)).toBeCloseTo(ac, 2);
      expect(hectaresToAcres(ha) * BIGHA_PER_ACRE).toBeCloseTo(bigha, 1);
    }
  });
});

describe("record set integrity", () => {
  it("every record's village exists in the registry, with a matching halka", () => {
    for (const r of OFFICIAL_RECORDS) {
      const v = findVillage(r.village);
      expect(v, r.village).toBeDefined();
      expect(v!.halka, r.village).toBe(r.halka);
      expect(v!.tehsilCode, r.village).toBe(r.tehsilCode);
    }
  });

  it("owner shares sum to exactly 100 on every record", () => {
    for (const r of OFFICIAL_RECORDS) {
      const sum = r.owners.reduce((s, o) => s + o.sharePercent, 0);
      expect(sum, r.landId).toBe(100);
    }
  });

  it("land ids and (village, khasra) pairs are unique", () => {
    expect(new Set(OFFICIAL_RECORDS.map((r) => r.landId)).size).toBe(OFFICIAL_RECORDS.length);
    expect(new Set(OFFICIAL_RECORDS.map((r) => `${r.village}|${r.khasraNumber}`)).size).toBe(
      OFFICIAL_RECORDS.length,
    );
  });

  it("no crop entry exceeds the parcel's own area", () => {
    for (const r of OFFICIAL_RECORDS)
      for (const c of r.crops) expect(c.areaHectares, `${r.landId} ${c.crop}`).toBeLessThanOrEqual(r.areaHectares + 1e-9);
  });

  it("derived helpers agree with the raw factors", () => {
    const r = OFFICIAL_RECORDS[0];
    expect(derivedAcres(r)).toBeCloseTo(4.55, 2);
    expect(derivedBigha(r)).toBeCloseTo(7.28, 1);
  });
});

describe("mandi board", () => {
  it("prices are internally coherent: min <= modal <= max", () => {
    for (const m of MANDI_RATES) {
      expect(m.min, m.crop).toBeLessThanOrEqual(m.modal);
      expect(m.modal, m.crop).toBeLessThanOrEqual(m.max);
    }
  });
});

describe("demo archive", () => {
  it("is deterministic, full-size, and stamped synthetic on every row", async () => {
    const { demoArchive, ARCHIVE_SIZE } = await import("@/lib/demo-archive");
    const rows = demoArchive();
    expect(rows).toHaveLength(ARCHIVE_SIZE);
    expect(rows.every((r) => r.dataset === "synthetic_demo")).toBe(true);
    expect(rows.every((r) => r.landId.startsWith("DEMO-"))).toBe(true);
    // Deterministic: the same index always generates the same record.
    expect(demoArchive()[41]).toEqual(rows[41]);
  });

  it("never borrows a real bank's name for a fictional mortgage", async () => {
    const { demoArchive } = await import("@/lib/demo-archive");
    const lenders = new Set(
      demoArchive().filter((r) => r.mortgage.isMortgaged).map((r) => r.mortgage.lender!.split(",")[0]),
    );
    for (const l of lenders) {
      expect(l).toMatch(/सहकारी|ग्रामीण|साख समिति/);
    }
  });

  it("search narrows by name, khasra and tehsil, with stable pagination", async () => {
    const { searchArchive } = await import("@/lib/demo-archive");
    const all = searchArchive({});
    expect(all.total).toBe(15000);
    const byName = searchArchive({ q: "रमेश" });
    expect(byName.total).toBeGreaterThan(0);
    expect(byName.total).toBeLessThan(all.total);
    const byTehsil = searchArchive({ tehsilCode: "JBL-05" });
    expect(byTehsil.total).toBeGreaterThan(0);
    expect(byTehsil.rows.every((r) => r.landId.includes("-JBL-05-"))).toBe(true);
    const p1 = searchArchive({ page: 1, pageSize: 20 });
    const p2 = searchArchive({ page: 2, pageSize: 20 });
    expect(p1.rows[0].id).not.toBe(p2.rows[0].id);
    expect(searchArchive({ page: 1, pageSize: 20 }).rows[0]).toEqual(p1.rows[0]);
  });

  it("its area conversions follow the same survey factors as everything else", async () => {
    const { demoArchive } = await import("@/lib/demo-archive");
    for (const r of demoArchive().slice(0, 200)) {
      expect(r.areaAcres).toBeCloseTo(r.areaHectares * 2.4710538, 1);
      expect(r.areaBigha).toBeCloseTo(r.areaAcres * 1.6, 1);
    }
  });
});
