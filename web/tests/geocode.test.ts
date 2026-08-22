/**
 * Keyless geocoder tests.
 *
 * The provider (OpenStreetMap Nominatim) is not reachable from CI, so the
 * network layer is mocked and the parsing/labelling contract is asserted —
 * that is where the bugs would actually be.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode } from "@/lib/geocode";

const NOMINATIM_ROW = {
  display_name: "Sihora, Jabalpur, Madhya Pradesh, 483225, India",
  name: "Sihora",
  lat: "23.4869",
  lon: "80.1046",
  address: { village: "Sihora", state_district: "Jabalpur", state: "Madhya Pradesh" },
};

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
  it("parses a place into a [lng, lat] position and a short label", async () => {
    mockFetchOnce([NOMINATIM_ROW]);
    const [place] = await geocode("Sihora");
    expect(place.position).toEqual([80.1046, 23.4869]); // lng, lat order
    expect(place.short).toBe("Sihora, Jabalpur");
    expect(place.label).toContain("Madhya Pradesh");
  });

  it("biases the query to Madhya Pradesh and restricts to India", async () => {
    const spy = mockFetchOnce([NOMINATIM_ROW]);
    await geocode("Panagar");
    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.searchParams.get("q")).toBe("Panagar, Madhya Pradesh, India");
    expect(url.searchParams.get("countrycodes")).toBe("in");
    expect(Number(url.searchParams.get("limit"))).toBeLessThanOrEqual(6);
  });

  it("does not call the network for very short queries", async () => {
    const spy = mockFetchOnce([]);
    expect(await geocode("si")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("falls back to the first display_name segment when address details are missing", async () => {
    mockFetchOnce([{ display_name: "Barela, Jabalpur, India", lat: "23.09", lon: "80.08" }]);
    const [place] = await geocode("Barela");
    expect(place.short).toBe("Barela");
  });

  it("throws on a provider error so the UI can show its fallback message", async () => {
    mockFetchOnce({}, false, 503);
    await expect(geocode("Sihora")).rejects.toThrow(/503/);
  });
});
