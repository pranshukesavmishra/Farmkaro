import type { Metadata } from "next";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = { title: "Discover farmland" };

const RADII = [5, 10, 20, 50];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; radiusKm?: string }>;
}) {
  const sp = await searchParams;
  const parsed = Number(sp.radiusKm);
  const initialRadiusKm = RADII.includes(parsed) ? parsed : 20;
  return <DiscoverClient initialQuery={sp.q?.trim() ?? ""} initialRadiusKm={initialRadiusKm} />;
}
