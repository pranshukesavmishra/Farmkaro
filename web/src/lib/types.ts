import type { PolygonCoords, Position } from "./geo";

/* ---------------------------------------------------------------------------
 * Verification is never a boolean. Each ladder is an ordered, honest sequence.
 * Mirrors docs/05-product-roadmap.md §5.5 and the CHECK constraints in
 * docs/07-data-model.sql.
 * ------------------------------------------------------------------------- */

export type IdentityStatus = "unverified" | "id_submitted" | "id_checked_by_farmkaro";

export type DocumentStatus = "none" | "uploaded" | "under_review" | "reviewed_by_farmkaro";

export type GeometryStatus =
  | "declared"
  | "gps_captured"
  | "boundary_drawn"
  | "boundary_walked_by_farmkaro"
  | "matched_to_cadastral_record";

export type BoundarySource =
  | "owner_drawn"
  | "gps_walk"
  | "geojson_import"
  | "cadastral_import"
  | "ai_suggested";

export type WaterSource = "borewell" | "canal" | "river" | "pond" | "well" | "rainfed";
export type RoadAccess = "none" | "kutcha" | "pucca" | "highway";
export type ListingStatus = "draft" | "active" | "paused" | "leased";
export type RegistrationStatus =
  | "unregistered"
  | "stamped"
  | "submitted_for_registration"
  | "registered";

export interface DocumentRef {
  id: string;
  docType: "khasra" | "khatauni" | "ownership" | "identity" | "supporting";
  label: string;
  status: DocumentStatus;
  uploadedAt: string;
  reviewedAt?: string;
  /** Documents are private. The UI shows status, never a public URL. */
  private: true;
}

export interface Owner {
  id: string;
  name: string;
  identityStatus: IdentityStatus;
  memberSince: string;
  completedLeases: number;
  /** Ratings exist only where a completed lease produced one. */
  rating?: number;
  ratingCount: number;
}

export interface MatchBreakdown {
  location: number;
  cropSuitability: number;
  water: number;
  price: number;
  area: number;
}

export interface Parcel {
  id: string;
  ref: string; // human-facing, e.g. "FK-JBP-0142"
  ownerId: string;

  geometry: PolygonCoords;
  centroid: Position;
  areaSqM: number;
  areaAcres: number;
  perimeterM: number;
  declaredAreaAcres?: number;
  areaVariancePct?: number;

  khasraNumber: string;
  ulpin?: string; // 14-digit Bhu-Aadhaar, when the owner has it
  village: string;
  tehsil: string;
  district: string;
  state: string;

  geometryStatus: GeometryStatus;
  boundarySource: BoundarySource;
  boundaryWalkedAt?: string;

  soilType: string;
  waterSources: WaterSource[];
  irrigatedAcres?: number;
  electricity: boolean;
  electricityHours?: number;
  roadAccess: RoadAccess;
  roadDistanceM: number;
  previousCrops: string[];
  suitableCrops: string[];

  documents: DocumentRef[];
  photoTone?: string;
}

export interface Listing {
  id: string;
  parcelId: string;
  status: ListingStatus;
  title: string;
  description: string;
  rentAnnual: number;
  rentPerAcre: number;
  deposit: number;
  leaseMinYears: number;
  leaseMaxYears: number;
  availableFrom: string;
  cropRestrictions: string[];
  publishedAt: string;
  enquiries: number;
  savedBy: number;
}

/** A parcel + its listing + owner, joined for display. */
export interface ParcelView extends Parcel {
  listing: Listing;
  owner: Owner;
  distanceM?: number;
  match?: { score: number; breakdown: MatchBreakdown };
  /** Real transacted comparables. Zero comparables ⇒ no estimate is shown. */
  comparables: { count: number; lowPerAcre: number; highPerAcre: number };
}

export interface Lease {
  id: string;
  ref: string;
  parcelId: string;
  parcelRef: string;
  village: string;
  areaAcres: number;
  lesseeName: string;
  lessorName: string;
  startDate: string;
  endDate: string;
  rentAnnual: number;
  status: "active" | "expiring" | "completed" | "signed";
  registrationStatus: RegistrationStatus;
  governingAct?: string;
  createsTenancyRights: false;
  nextPaymentDue?: string;
  nextPaymentAmount?: number;
}

export interface SearchFilters {
  lng?: number;
  lat?: number;
  radiusKm?: number;
  minAcres?: number;
  maxAcres?: number;
  maxRentPerAcre?: number;
  crop?: string;
  water?: WaterSource | "any";
  electricity?: boolean;
  roadAccess?: RoadAccess | "any";
  minVerification?: GeometryStatus | "any";
  bbox?: [number, number, number, number];
  sort?: "match" | "distance" | "rent_asc" | "rent_desc" | "area_desc";
  limit?: number;
}

/* ---- display helpers ---------------------------------------------------- */

export const GEOMETRY_LADDER: GeometryStatus[] = [
  "declared",
  "gps_captured",
  "boundary_drawn",
  "boundary_walked_by_farmkaro",
  "matched_to_cadastral_record",
];

export const GEOMETRY_LABEL: Record<GeometryStatus, string> = {
  declared: "Area declared by owner",
  gps_captured: "GPS location captured",
  boundary_drawn: "Boundary supplied",
  boundary_walked_by_farmkaro: "Boundary walked by FarmKaro",
  matched_to_cadastral_record: "Matched to cadastral record",
};

export const DOCUMENT_LABEL: Record<DocumentStatus, string> = {
  none: "Not uploaded",
  uploaded: "Uploaded",
  under_review: "Under review",
  reviewed_by_farmkaro: "Reviewed by FarmKaro",
};

export const IDENTITY_LABEL: Record<IdentityStatus, string> = {
  unverified: "Identity not submitted",
  id_submitted: "Identity submitted",
  id_checked_by_farmkaro: "Identity checked by FarmKaro",
};

export const WATER_LABEL: Record<WaterSource, string> = {
  borewell: "Borewell",
  canal: "Canal",
  river: "River",
  pond: "Pond",
  well: "Open well",
  rainfed: "Rain-fed",
};

export const ROAD_LABEL: Record<RoadAccess, string> = {
  none: "No direct road",
  kutcha: "Kutcha road",
  pucca: "Pucca road",
  highway: "Highway frontage",
};

export const REGISTRATION_LABEL: Record<RegistrationStatus, string> = {
  unregistered: "Not registered",
  stamped: "Stamped",
  submitted_for_registration: "Submitted for registration",
  registered: "Registered",
};
