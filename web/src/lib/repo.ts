/**
 * Repository layer.
 *
 * One interface, two implementations. The in-memory one runs the app with no
 * infrastructure; the PostGIS one is what production uses. Search semantics
 * are written to mirror the SQL in docs/06-technical-architecture.md §6.5 —
 * bbox intersection for viewport queries, ST_DWithin on the geography cast
 * for radius — so behaviour doesn't drift when the backing store changes.
 */
import { bboxIntersects, bboxOf, haversineM } from "./geo";
import { scoreParcel } from "./match";
import { seedData } from "./seed";
import type { Lease, ParcelView, SearchFilters } from "./types";
import { GEOMETRY_LADDER } from "./types";

export interface ParcelRepository {
  search(filters: SearchFilters): Promise<ParcelView[]>;
  byId(id: string): Promise<ParcelView | null>;
  byOwner(ownerId: string): Promise<ParcelView[]>;
  leases(): Promise<Lease[]>;
}

function join(): ParcelView[] {
  const { parcels, listings, owners, comparables } = seedData();
  const listingByParcel = new Map(listings.map((l) => [l.parcelId, l]));
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return parcels.flatMap((p) => {
    const listing = listingByParcel.get(p.id);
    const owner = ownerById.get(p.ownerId);
    if (!listing || !owner) return [];
    return [{ ...p, listing, owner, comparables: comparables[p.village] ?? { count: 0, lowPerAcre: 0, highPerAcre: 0 } }];
  });
}

class InMemoryParcelRepository implements ParcelRepository {
  async search(f: SearchFilters): Promise<ParcelView[]> {
    let rows = join().filter((p) => p.listing.status === "active");

    if (f.bbox) {
      rows = rows.filter((p) => bboxIntersects(bboxOf(p.geometry), f.bbox!));
    }

    if (f.lng != null && f.lat != null) {
      const radiusM = (f.radiusKm ?? 25) * 1000;
      rows = rows
        .map((p) => ({ ...p, distanceM: haversineM([f.lng!, f.lat!], p.centroid) }))
        .filter((p) => p.distanceM! <= radiusM);
    }

    if (f.minAcres != null) rows = rows.filter((p) => p.areaAcres >= f.minAcres!);
    if (f.maxAcres != null) rows = rows.filter((p) => p.areaAcres <= f.maxAcres!);
    if (f.maxRentPerAcre != null) rows = rows.filter((p) => p.listing.rentPerAcre <= f.maxRentPerAcre!);
    if (f.electricity) rows = rows.filter((p) => p.electricity);

    if (f.water && f.water !== "any") {
      rows = rows.filter((p) => p.waterSources.includes(f.water as never));
    }
    if (f.roadAccess && f.roadAccess !== "any") {
      const rank: Record<string, number> = { none: 0, kutcha: 1, pucca: 2, highway: 3 };
      rows = rows.filter((p) => rank[p.roadAccess] >= rank[f.roadAccess as string]);
    }
    if (f.crop) {
      const c = f.crop.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.suitableCrops.some((x) => x.toLowerCase().includes(c)) ||
          p.previousCrops.some((x) => x.toLowerCase().includes(c)),
      );
    }
    if (f.minVerification && f.minVerification !== "any") {
      const min = GEOMETRY_LADDER.indexOf(f.minVerification);
      rows = rows.filter((p) => GEOMETRY_LADDER.indexOf(p.geometryStatus) >= min);
    }

    rows = rows.map((p) => ({ ...p, match: scoreParcel(p, f) }));

    const sort = f.sort ?? "match";
    rows.sort((a, b) => {
      switch (sort) {
        case "distance":
          return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity);
        case "rent_asc":
          return a.listing.rentPerAcre - b.listing.rentPerAcre;
        case "rent_desc":
          return b.listing.rentPerAcre - a.listing.rentPerAcre;
        case "area_desc":
          return b.areaAcres - a.areaAcres;
        default:
          return (b.match?.score ?? 0) - (a.match?.score ?? 0);
      }
    });

    return f.limit ? rows.slice(0, f.limit) : rows;
  }

  async byId(id: string): Promise<ParcelView | null> {
    return join().find((p) => p.id === id || p.ref === id) ?? null;
  }

  async byOwner(ownerId: string): Promise<ParcelView[]> {
    return join().filter((p) => p.ownerId === ownerId);
  }

  async leases(): Promise<Lease[]> {
    return seedData().leases;
  }
}

/**
 * When DATABASE_URL is present, swap in a PostGIS-backed repository
 * implementing the same interface against docs/07-data-model.sql. Until then
 * the app runs entirely on the in-memory sample set, which is why it starts
 * with no infrastructure at all.
 */
let instance: ParcelRepository | null = null;
export function getRepository(): ParcelRepository {
  if (!instance) instance = new InMemoryParcelRepository();
  return instance;
}

export const dataSource = process.env.DATABASE_URL ? "postgis" : "sample";
