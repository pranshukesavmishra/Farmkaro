import type { MatchBreakdown, ParcelView, SearchFilters } from "./types";

/**
 * Explainable match score.
 *
 * Every component is a plain, inspectable function of stated preferences —
 * no model, no hidden weights. The UI always renders the breakdown alongside
 * the headline number (docs/05-product-roadmap.md, Phase 4 rule: a number
 * FarmKaro cannot explain is a number FarmKaro does not display).
 */

const WEIGHTS: Record<keyof MatchBreakdown, number> = {
  location: 0.28,
  cropSuitability: 0.22,
  water: 0.2,
  price: 0.18,
  area: 0.12,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreParcel(
  p: Omit<ParcelView, "match">,
  f: SearchFilters,
): { score: number; breakdown: MatchBreakdown } {
  const radiusM = (f.radiusKm ?? 25) * 1000;
  const location =
    p.distanceM == null ? 70 : clamp(100 - (p.distanceM / radiusM) * 55);

  const wantedCrop = f.crop?.toLowerCase();
  const cropSuitability = !wantedCrop
    ? 78
    : p.suitableCrops.some((c) => c.toLowerCase().includes(wantedCrop))
      ? 96
      : p.previousCrops.some((c) => c.toLowerCase().includes(wantedCrop))
        ? 84
        : 46;

  const irrigatedShare = p.irrigatedAcres ? p.irrigatedAcres / p.areaAcres : 0;
  const water = p.waterSources.includes("rainfed")
    ? 38
    : clamp(60 + irrigatedShare * 38);

  const price = !f.maxRentPerAcre
    ? 75
    : p.listing.rentPerAcre <= f.maxRentPerAcre
      ? clamp(80 + ((f.maxRentPerAcre - p.listing.rentPerAcre) / f.maxRentPerAcre) * 20)
      : clamp(70 - ((p.listing.rentPerAcre - f.maxRentPerAcre) / f.maxRentPerAcre) * 90);

  let area = 80;
  if (f.minAcres != null || f.maxAcres != null) {
    const lo = f.minAcres ?? 0;
    const hi = f.maxAcres ?? Infinity;
    if (p.areaAcres >= lo && p.areaAcres <= hi) area = 95;
    else {
      const off = p.areaAcres < lo ? (lo - p.areaAcres) / Math.max(lo, 1) : (p.areaAcres - hi) / Math.max(hi, 1);
      area = clamp(90 - off * 100);
    }
  }

  // Infrastructure and verification nudge the total, transparently.
  const infraBonus =
    (p.electricity ? 2 : 0) +
    (p.roadAccess === "highway" || p.roadAccess === "pucca" ? 2 : 0) +
    (p.geometryStatus === "matched_to_cadastral_record" ? 3 : p.geometryStatus === "boundary_walked_by_farmkaro" ? 2 : 0);

  const breakdown: MatchBreakdown = { location, cropSuitability, water, price, area };
  const weighted =
    location * WEIGHTS.location +
    cropSuitability * WEIGHTS.cropSuitability +
    water * WEIGHTS.water +
    price * WEIGHTS.price +
    area * WEIGHTS.area;

  return { score: clamp(weighted + infraBonus), breakdown };
}

export const MATCH_LABELS: Record<keyof MatchBreakdown, string> = {
  location: "Location",
  cropSuitability: "Crop suitability",
  water: "Water",
  price: "Price",
  area: "Area",
};
