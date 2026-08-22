"use client";

import dynamic from "next/dynamic";
import { hasGoogleMaps } from "@/lib/google-maps";
import type { ParcelView } from "@/lib/types";
import type { Position } from "@/lib/geo";

/**
 * One map, two engines. Google Maps (real Google satellite) is used when a
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured; otherwise the keyless
 * MapLibre + Esri World Imagery map is used. Both render the same thing:
 * price-pill pins for every farm plus the selected farm's real boundary
 * polygon — pin and polygon combined.
 */

const skeleton = () => <div className="h-full w-full animate-pulse bg-[var(--line)]/50" />;

const MapLibreMap = dynamic(() => import("./parcel-map").then((m) => m.ParcelMap), {
  ssr: false,
  loading: skeleton,
});
const GoogleMap = dynamic(() => import("./google-parcel-map").then((m) => m.GoogleParcelMap), {
  ssr: false,
  loading: skeleton,
});

interface Props {
  parcels: ParcelView[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  center?: Position;
  radiusKm?: number;
  className?: string;
}

export function DiscoveryMap(props: Props) {
  return hasGoogleMaps() ? <GoogleMap {...props} /> : <MapLibreMap {...props} />;
}

export { MapLegend } from "./parcel-map";
