/**
 * GeocodingConnector — keyless place search.
 *
 * Default provider is OpenStreetMap Nominatim: no API key, no signup, and it
 * knows Indian villages, tehsils and districts well. Results are biased to
 * India and (softly) to the pilot district. Swap providers via
 * NEXT_PUBLIC_GEOCODER_URL without touching call sites, exactly like every
 * other connector in the architecture.
 *
 * Nominatim's usage policy asks for modest request rates and attribution, so
 * calls here are debounced by the caller and capped to a handful of results.
 */
import type { Position } from "./geo";

export interface Place {
  label: string;
  short: string;
  position: Position;
}

const ENDPOINT = process.env.NEXT_PUBLIC_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search";

/** Bias results toward Madhya Pradesh / the Jabalpur pilot area. */
const VIEWBOX = "78.6,22.2,81.6,24.2";

export async function geocode(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q: `${q}, Madhya Pradesh, India`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "in",
    viewbox: VIEWBOX,
    bounded: "0",
  });

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);

  const rows = (await res.json()) as Array<{
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }>;

  return rows.map((r) => {
    const a = r.address ?? {};
    const locality = r.name || a.village || a.town || a.city || a.hamlet || a.suburb || "";
    const district = a.state_district || a.county || "";
    return {
      label: r.display_name,
      short: [locality, district].filter(Boolean).join(", ") || r.display_name.split(",")[0],
      position: [Number(r.lon), Number(r.lat)] as Position,
    };
  });
}

export const GEOCODER_ATTRIBUTION = "Place search © OpenStreetMap contributors";
