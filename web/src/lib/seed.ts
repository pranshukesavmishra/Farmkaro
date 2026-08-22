/**
 * Deterministic sample dataset for the Jabalpur base district.
 *
 * IMPORTANT — this is clearly-labelled sample data, not real listings. The UI
 * says so in the header (see `DATA_NOTICE`). Per docs/01-postmortem-v1.md the
 * previous site shipped demo data behind a disclaimer; the rule here is that
 * sample data is allowed only while it is unmistakably marked as sample, and
 * it is replaced parcel-by-parcel as real supply is onboarded.
 *
 * Geometry is generated around real village coordinates so polygons land on
 * actual farmland in satellite imagery.
 */
import {
  bboxOf,
  centroid,
  m2ToAcres,
  perimeterM,
  polygonAreaM2,
  type PolygonCoords,
  type Position,
} from "./geo";
import type {
  BoundarySource,
  DocumentRef,
  DocumentStatus,
  GeometryStatus,
  Lease,
  Listing,
  Owner,
  Parcel,
  RoadAccess,
  WaterSource,
} from "./types";

export const DATA_NOTICE =
  "Sample parcels for the Jabalpur pilot district — not live listings.";

export const JABALPUR: Position = [79.9864, 23.1815];

/** mulberry32 — small, fast, deterministic. Same seed ⇒ same map, every build. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VILLAGES: { name: string; tehsil: string; at: Position }[] = [
  { name: "Panagar", tehsil: "Panagar", at: [79.9944, 23.2884] },
  { name: "Barela", tehsil: "Jabalpur", at: [80.0857, 23.0961] },
  { name: "Patan", tehsil: "Patan", at: [79.6889, 23.2833] },
  { name: "Sihora", tehsil: "Sihora", at: [80.1046, 23.4869] },
  { name: "Kundam", tehsil: "Kundam", at: [80.346, 23.217] },
  { name: "Bargi", tehsil: "Jabalpur", at: [79.9312, 23.0489] },
  { name: "Majholi", tehsil: "Majholi", at: [79.9045, 23.4998] },
  { name: "Shahpura", tehsil: "Shahpura", at: [79.6512, 23.1608] },
  { name: "Tilwara", tehsil: "Jabalpur", at: [79.9231, 23.1122] },
    // Distinct from Belkheda (Patan tehsil) in the district registry — two
  // different villages with near-identical names.
  { name: "Belkhera", tehsil: "Panagar", at: [80.0421, 23.2411] },
  { name: "Khamaria", tehsil: "Jabalpur", at: [79.9701, 23.2265] },
  { name: "Gosalpur", tehsil: "Sihora", at: [80.0512, 23.3866] },
];

const SOILS = ["Black cotton (kali)", "Red loam", "Alluvial loam", "Sandy loam", "Mixed red-black"];
const KHARIF = ["Soybean", "Paddy", "Maize", "Arhar (tur)", "Cotton"];
const RABI = ["Wheat", "Gram (chana)", "Mustard", "Masoor", "Berseem"];

const OWNER_NAMES = [
  "Ramesh Patel", "Sunita Yadav", "Devendra Singh Thakur", "Kamla Bai Lodhi",
  "Mohan Lal Kushwaha", "Anil Jain", "Shivkumar Patel", "Rekha Verma",
  "Jagdish Prasad Tiwari", "Farida Khan", "Ganesh Rao Deshmukh", "Prem Bai Gond",
  "Suresh Chandra Dubey", "Laxmi Narayan Sahu", "Ashok Kumar Raikwar",
];

function ringFor(center: Position, targetAcres: number, r: () => number): PolygonCoords {
  const areaM2 = targetAcres * 4046.8564224;
  // Fields are rarely circular — bias toward a rectangular-ish parcel.
  const aspect = 0.55 + r() * 1.1;
  const halfW = Math.sqrt(areaM2 * aspect) / 2;
  const halfH = Math.sqrt(areaM2 / aspect) / 2;
  const rot = r() * Math.PI;

  const n = 4 + Math.floor(r() * 3); // 4–6 vertices, like a real irregular khasra
  const pts: Position[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.25;
    const jitter = 0.86 + r() * 0.28;
    let dx = Math.cos(t) * halfW * jitter;
    let dy = Math.sin(t) * halfH * jitter;
    const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
    const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
    const dLat = ry / 111320;
    const dLng = rx / (111320 * Math.cos((center[1] * Math.PI) / 180));
    pts.push([+(center[0] + dLng).toFixed(6), +(center[1] + dLat).toFixed(6)]);
  }
  pts.push(pts[0]);
  return [pts];
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function pickSome<T>(arr: T[], r: () => number, min: number, max: number): T[] {
  const n = min + Math.floor(r() * (max - min + 1));
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

const iso = (daysFromNow: number) =>
  new Date(Date.UTC(2026, 7, 20) + daysFromNow * 86400000).toISOString().slice(0, 10);

function buildDocs(r: () => number, tier: number): DocumentRef[] {
  const plan: { t: DocumentRef["docType"]; label: string }[] = [
    { t: "khasra", label: "Khasra (B-1)" },
    { t: "khatauni", label: "Khatauni extract" },
    { t: "ownership", label: "Ownership proof" },
    { t: "identity", label: "Owner ID" },
  ];
  const statuses: DocumentStatus[][] = [
    ["uploaded", "none", "none", "uploaded"],
    ["uploaded", "uploaded", "under_review", "uploaded"],
    ["reviewed_by_farmkaro", "reviewed_by_farmkaro", "under_review", "reviewed_by_farmkaro"],
    ["reviewed_by_farmkaro", "reviewed_by_farmkaro", "reviewed_by_farmkaro", "reviewed_by_farmkaro"],
  ];
  const row = statuses[Math.min(tier, statuses.length - 1)];
  return plan.map((p, i) => ({
    id: `doc-${p.t}-${Math.floor(r() * 1e6)}`,
    docType: p.t,
    label: p.label,
    status: row[i],
    uploadedAt: iso(-40 - Math.floor(r() * 120)),
    reviewedAt: row[i] === "reviewed_by_farmkaro" ? iso(-10 - Math.floor(r() * 25)) : undefined,
    private: true,
  }));
}

export interface SeedData {
  parcels: Parcel[];
  listings: Listing[];
  owners: Owner[];
  leases: Lease[];
  comparables: Record<string, { count: number; lowPerAcre: number; highPerAcre: number }>;
}

function build(): SeedData {
  const r = rng(20260820);
  const owners: Owner[] = OWNER_NAMES.map((name, i) => {
    const completed = i % 4 === 0 ? 0 : Math.floor(r() * 4);
    const ratingCount = completed === 0 ? 0 : completed;
    return {
      id: `own-${i + 1}`,
      name,
      identityStatus:
        i % 5 === 0 ? "id_submitted" : i % 7 === 0 ? "unverified" : "id_checked_by_farmkaro",
      memberSince: iso(-200 - i * 17),
      completedLeases: completed,
      rating: ratingCount ? +(3.9 + r() * 1.0).toFixed(1) : undefined,
      ratingCount,
    };
  });

  const parcels: Parcel[] = [];
  const listings: Listing[] = [];

  const COUNT = 64;
  for (let i = 0; i < COUNT; i++) {
    const v = VILLAGES[i % VILLAGES.length];
    // Scatter within ~4.5 km of the village centre.
    const spreadLat = (r() - 0.5) * 0.075;
    const spreadLng = (r() - 0.5) * 0.085;
    const center: Position = [v.at[0] + spreadLng, v.at[1] + spreadLat];

    const targetAcres = +(1.5 + r() * r() * 38).toFixed(2);
    const geometry = ringFor(center, targetAcres, r);
    const areaSqM = polygonAreaM2(geometry);
    const areaAcres = m2ToAcres(areaSqM);
    const c = centroid(geometry);

    const tier = Math.floor(r() * 4);
    // Sample geometry is generated, not surveyed. It therefore NEVER claims a
    // confirmed boundary: the highest rung a sample parcel may reach is
    // "gps_captured" (a location), because drawing a dashed outline that does
    // not match the field underneath is worse than drawing nothing at all.
    // Real rungs are earned by real parcels through onboarding.
    const geometryStatus: GeometryStatus = "gps_captured";
    const boundarySource: BoundarySource = "geojson_import";

    const water = pickSome<WaterSource>(
      ["borewell", "canal", "river", "pond", "well"],
      r,
      r() > 0.22 ? 1 : 0,
      2,
    );
    if (!water.length) water.push("rainfed");
    const irrigated = water.includes("rainfed") ? 0 : +(areaAcres * (0.5 + r() * 0.5)).toFixed(1);
    const roadAccess: RoadAccess =
      r() > 0.82 ? "highway" : r() > 0.45 ? "pucca" : r() > 0.12 ? "kutcha" : "none";

    const declared = r() > 0.55 ? +(areaAcres * (0.9 + r() * 0.22)).toFixed(2) : undefined;

    const parcel: Parcel = {
      id: `p-${i + 1}`,
      ref: `FK-JBP-${String(1000 + i * 7).slice(-4)}`,
      ownerId: owners[i % owners.length].id,
      geometry,
      centroid: c,
      areaSqM: +areaSqM.toFixed(1),
      areaAcres: +areaAcres.toFixed(3),
      perimeterM: +perimeterM(geometry[0]).toFixed(1),
      declaredAreaAcres: declared,
      areaVariancePct: declared
        ? +(((Math.abs(areaAcres - declared) / declared) * 100).toFixed(1))
        : undefined,
      khasraNumber: `${100 + Math.floor(r() * 800)}/${1 + Math.floor(r() * 9)}`,
      // No ULPIN on sample parcels: it would imply a cadastral match none of
      // them actually has.
      ulpin: undefined,
      village: v.name,
      tehsil: v.tehsil,
      district: "Jabalpur",
      state: "Madhya Pradesh",
      geometryStatus,
      boundarySource,
      boundaryWalkedAt: undefined,
      soilType: pick(SOILS, r),
      waterSources: water,
      irrigatedAcres: irrigated || undefined,
      electricity: r() > 0.3,
      electricityHours: r() > 0.3 ? 6 + Math.floor(r() * 8) : undefined,
      roadAccess,
      roadDistanceM: roadAccess === "highway" ? 0 : Math.floor(r() * 1800),
      previousCrops: pickSome([...KHARIF, ...RABI], r, 2, 3),
      suitableCrops: pickSome([...KHARIF, ...RABI], r, 3, 5),
      documents: buildDocs(r, tier),
    };
    parcels.push(parcel);

    // Rent scales with irrigation, road, and proximity to the city.
    const distKm = Math.hypot(
      (c[0] - JABALPUR[0]) * 102, (c[1] - JABALPUR[1]) * 111,
    );
    const base = 11000 + (irrigated > 0 ? 6500 : 0);
    const roadBump = roadAccess === "highway" ? 4500 : roadAccess === "pucca" ? 2200 : 0;
    const cityBump = Math.max(0, 6000 - distKm * 130);
    const perAcre = Math.round((base + roadBump + cityBump + r() * 3000) / 250) * 250;
    const rentAnnual = Math.round((perAcre * areaAcres) / 500) * 500;

    listings.push({
      id: `l-${i + 1}`,
      parcelId: parcel.id,
      status: i % 11 === 0 ? "leased" : i % 17 === 0 ? "paused" : "active",
      title: `${parcel.areaAcres.toFixed(1)} acres in ${v.name}`,
      description:
        `${water.includes("rainfed") ? "Rain-fed" : WATER_TEXT(water)} land in ${v.name}, ` +
        `${v.tehsil} tehsil. ${parcel.soilType}. ` +
        `${roadAccess === "none" ? "Reached by field path." : `${ROAD_TEXT(roadAccess)} access.`} ` +
        `Last grown: ${parcel.previousCrops.slice(0, 2).join(", ")}.`,
      rentAnnual,
      rentPerAcre: perAcre,
      deposit: Math.round((rentAnnual * 0.25) / 500) * 500,
      leaseMinYears: r() > 0.6 ? 3 : 1,
      leaseMaxYears: r() > 0.75 ? 9 : r() > 0.4 ? 5 : 3,
      availableFrom: iso(Math.floor(r() * 70)),
      cropRestrictions: r() > 0.78 ? ["No sugarcane"] : [],
      publishedAt: iso(-Math.floor(r() * 90)),
      enquiries: Math.floor(r() * 14),
      savedBy: Math.floor(r() * 22),
    });
  }

  // Transacted comparables, by village. Only villages with real completed
  // leases get a range — the rest report zero and the UI shows no estimate.
  const comparables: SeedData["comparables"] = {};
  for (const v of VILLAGES) {
    const count = Math.floor(r() * 7);
    if (count === 0) {
      comparables[v.name] = { count: 0, lowPerAcre: 0, highPerAcre: 0 };
      continue;
    }
    const mid = 12000 + Math.floor(r() * 9000);
    comparables[v.name] = {
      count,
      lowPerAcre: Math.round((mid * 0.82) / 250) * 250,
      highPerAcre: Math.round((mid * 1.19) / 250) * 250,
    };
  }

  const leases: Lease[] = [0, 1, 2, 3, 4].map((i) => {
    const p = parcels[i * 5 + 2];
    const l = listings[i * 5 + 2];
    const startOffset = -300 + i * 40;
    const registered: Lease["registrationStatus"] =
      i === 0 ? "registered" : i === 1 ? "registered" : i === 2 ? "submitted_for_registration" : i === 3 ? "stamped" : "registered";
    return {
      id: `lease-${i + 1}`,
      ref: `FK-L-${2026}${String(101 + i)}`,
      parcelId: p.id,
      parcelRef: p.ref,
      village: p.village,
      areaAcres: p.areaAcres,
      lesseeName: ["Narmada Krishak Producer Co.", "Ajay Patel", "Sanskriti Agro Farms", "Vindhya Seeds Pvt Ltd", "Rakesh Kushwaha"][i],
      lessorName: owners[(i * 5 + 2) % owners.length].name,
      startDate: iso(startOffset),
      endDate: iso(startOffset + 365 * (i === 3 ? 5 : 3)),
      rentAnnual: l.rentAnnual,
      status: i === 4 ? "expiring" : i === 3 ? "signed" : "active",
      registrationStatus: registered,
      governingAct: registered === "registered" ? "MP agricultural land leasing law" : undefined,
      createsTenancyRights: false,
      nextPaymentDue: iso(12 + i * 21),
      nextPaymentAmount: Math.round(l.rentAnnual / 2 / 500) * 500,
    };
  });

  return { parcels, listings, owners, leases, comparables };
}

function WATER_TEXT(w: WaterSource[]): string {
  const map: Record<WaterSource, string> = {
    borewell: "Borewell-irrigated",
    canal: "Canal-irrigated",
    river: "River-fed",
    pond: "Pond-fed",
    well: "Open-well irrigated",
    rainfed: "Rain-fed",
  };
  return map[w[0]];
}
function ROAD_TEXT(rd: RoadAccess): string {
  return rd === "highway" ? "Highway frontage" : rd === "pucca" ? "Pucca road" : "Kutcha road";
}

let cached: SeedData | null = null;
export function seedData(): SeedData {
  if (!cached) cached = build();
  return cached;
}

export function seedBBox() {
  const all = seedData().parcels.flatMap((p) => p.geometry);
  return bboxOf(all);
}
