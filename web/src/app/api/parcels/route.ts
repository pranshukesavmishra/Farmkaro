import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";
import type { GeometryStatus, RoadAccess, SearchFilters, WaterSource } from "@/lib/types";

const num = (v: string | null) => (v == null || v === "" ? undefined : Number(v));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  const bboxRaw = q.get("bbox");
  const bbox = bboxRaw?.split(",").map(Number);

  const filters: SearchFilters = {
    lng: num(q.get("lng")),
    lat: num(q.get("lat")),
    radiusKm: num(q.get("radiusKm")),
    minAcres: num(q.get("minAcres")),
    maxAcres: num(q.get("maxAcres")),
    maxRentPerAcre: num(q.get("maxRentPerAcre")),
    crop: q.get("crop") ?? undefined,
    water: (q.get("water") as WaterSource | "any" | null) ?? undefined,
    electricity: q.get("electricity") === "1" ? true : undefined,
    roadAccess: (q.get("roadAccess") as RoadAccess | "any" | null) ?? undefined,
    minVerification: (q.get("minVerification") as GeometryStatus | "any" | null) ?? undefined,
    bbox: bbox?.length === 4 ? (bbox as [number, number, number, number]) : undefined,
    sort: (q.get("sort") as SearchFilters["sort"]) ?? "match",
    // Viewport queries are capped; the UI never ships the whole layer to the browser.
    limit: Math.min(num(q.get("limit")) ?? 120, 500),
  };

  const parcels = await getRepository().search(filters);
  return NextResponse.json({ count: parcels.length, parcels });
}
