import { describe, expect, it } from "vitest";
import { scoreParcel } from "@/lib/match";
import { getRepository } from "@/lib/repo";
import { JABALPUR } from "@/lib/seed";

describe("explainable match scoring", () => {
  it("always returns a bounded score with a full breakdown", async () => {
    const rows = await getRepository().search({ lng: JABALPUR[0], lat: JABALPUR[1], radiusKm: 50 });
    expect(rows.length).toBeGreaterThan(10);
    for (const p of rows) {
      expect(p.match).toBeDefined();
      const { score, breakdown } = p.match!;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      for (const key of ["location", "cropSuitability", "water", "price", "area"] as const) {
        expect(breakdown[key]).toBeGreaterThanOrEqual(0);
        expect(breakdown[key]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("crop preference moves the crop component, not just the total", async () => {
    const [p] = await getRepository().search({ lng: JABALPUR[0], lat: JABALPUR[1], radiusKm: 50, limit: 1 });
    const wheatFarm = { ...p, suitableCrops: ["Wheat"], previousCrops: [] };
    const withCrop = scoreParcel(wheatFarm, { crop: "Wheat" });
    const wrongCrop = scoreParcel({ ...wheatFarm, suitableCrops: ["Cotton"] }, { crop: "Wheat" });
    expect(withCrop.breakdown.cropSuitability).toBeGreaterThan(wrongCrop.breakdown.cropSuitability);
  });

  it("search filters actually filter", async () => {
    const repo = getRepository();
    const cheap = await repo.search({ maxRentPerAcre: 15000 });
    for (const p of cheap) expect(p.listing.rentPerAcre).toBeLessThanOrEqual(15000);
    const big = await repo.search({ minAcres: 10 });
    for (const p of big) expect(p.areaAcres).toBeGreaterThanOrEqual(10);
    const radius = await repo.search({ lng: JABALPUR[0], lat: JABALPUR[1], radiusKm: 5 });
    for (const p of radius) expect(p.distanceM!).toBeLessThanOrEqual(5000);
  });

  it("zero-comparable villages report zero, never an invented range", async () => {
    const rows = await getRepository().search({});
    for (const p of rows) {
      if (p.comparables.count === 0) {
        expect(p.comparables.lowPerAcre).toBe(0);
        expect(p.comparables.highPerAcre).toBe(0);
      } else {
        expect(p.comparables.lowPerAcre).toBeGreaterThan(0);
        expect(p.comparables.highPerAcre).toBeGreaterThanOrEqual(p.comparables.lowPerAcre);
      }
    }
  });
});
