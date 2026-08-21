"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Loader2, MapPin, Map as MapIcon, SearchX, X } from "lucide-react";
import { DiscoveryMap, MapLegend } from "@/components/discovery-map";
import { ParcelCard, ParcelCardSkeleton } from "@/components/parcel-card";
import { MatchScore } from "@/components/match-score";
import { EmptyState } from "@/components/ui";
import { JABALPUR } from "@/lib/seed";
import { geocode, type Place } from "@/lib/geocode";
import { getRepository } from "@/lib/repo";
import { formatAcres, formatINR } from "@/lib/geo";
import type { ParcelView, SearchFilters, WaterSource } from "@/lib/types";
import { cn } from "@/lib/cn";

type SortKey = NonNullable<SearchFilters["sort"]>;

const WATER_OPTIONS: { value: WaterSource | "any"; label: string }[] = [
  { value: "any", label: "Any water" },
  { value: "borewell", label: "Borewell" },
  { value: "canal", label: "Canal" },
  { value: "river", label: "River" },
  { value: "pond", label: "Pond" },
  { value: "well", label: "Open well" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "match", label: "Best match" },
  { value: "distance", label: "Nearest first" },
  { value: "rent_asc", label: "Rent: low to high" },
  { value: "rent_desc", label: "Rent: high to low" },
  { value: "area_desc", label: "Largest first" },
];

const RADII = [5, 10, 20, 50];

export function DiscoverClient() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const parsedRadius = Number(searchParams.get("radiusKm"));
  const [radiusKm, setRadiusKm] = useState(RADII.includes(parsedRadius) ? parsedRadius : 20);
  const [water, setWater] = useState<WaterSource | "any">("any");
  const [minAcres, setMinAcres] = useState("");
  const [maxAcres, setMaxAcres] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [crop, setCrop] = useState("");
  const [electricity, setElectricity] = useState(false);
  const [sort, setSort] = useState<SortKey>("match");

  // Searched location (keyless geocoding). Falls back to the district centre.
  const [placeQuery, setPlaceQuery] = useState(initialQuery);
  const [placeCenter, setPlaceCenter] = useState<[number, number] | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const [parcels, setParcels] = useState<ParcelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("list");

  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search. The repository runs in the browser against the same
  // dataset the server renders, which keeps the whole discovery surface
  // deployable as a static site; when a PostGIS backend lands, this becomes
  // a fetch against /api/parcels with identical semantics.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const t = setTimeout(async () => {
      const filters: SearchFilters = {
        lng: (placeCenter ?? JABALPUR)[0],
        lat: (placeCenter ?? JABALPUR)[1],
        radiusKm,
        sort,
        limit: 80,
      };
      if (water !== "any") filters.water = water;
      if (minAcres) filters.minAcres = Number(minAcres);
      if (maxAcres) filters.maxAcres = Number(maxAcres);
      if (maxRent) filters.maxRentPerAcre = Number(maxRent);
      if (crop.trim()) filters.crop = crop.trim();
      if (electricity) filters.electricity = true;

      const rows = await getRepository().search(filters);
      if (cancelled) return;
      setParcels(rows);
      setSelectedId((prev) => (prev && rows.some((p) => p.id === prev) ? prev : null));
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [radiusKm, water, minAcres, maxAcres, maxRent, crop, electricity, sort, placeCenter]);

  const runPlaceSearch = useCallback(
    async (q?: string) => {
      const query = (q ?? placeQuery).trim();
      if (query.length < 3) return;
      setPlaceBusy(true);
      setPlaceError(null);
      try {
        const results = await geocode(query);
        if (!results.length) {
          setPlaceError(`No place found for “${query}”. Try a nearby town or tehsil.`);
          return;
        }
        const best: Place = results[0];
        setPlaceCenter(best.position);
        setPlaceLabel(best.short);
      } catch {
        setPlaceError("Place search is unavailable right now. Showing the district centre.");
      } finally {
        setPlaceBusy(false);
      }
    },
    [placeQuery],
  );

  // Honour ?q= from the homepage search on first load.
  const didInitialSearch = useRef(false);
  useEffect(() => {
    if (didInitialSearch.current || initialQuery.length < 3) return;
    didInitialSearch.current = true;
    void runPlaceSearch(initialQuery);
  }, [initialQuery, runPlaceSearch]);

  const selected = useMemo(
    () => parcels.find((p) => p.id === selectedId) ?? null,
    [parcels, selectedId],
  );

  const handleMapSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      // Bring the matching card into view in the list panel.
      requestAnimationFrame(() => {
        document
          .getElementById(`parcel-card-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  };

  const fieldCls = "field focus-ring py-2 text-sm leading-none";

  return (
    <div className="mx-auto max-w-shell">
      <div className="lg:flex">
        {/* Left panel */}
        <div
          className={cn(
            "thin-scroll shrink-0 px-4 pb-24 pt-6 sm:px-6 lg:h-[calc(100vh-64px)] lg:w-[452px] lg:overflow-y-auto lg:pb-10",
            view === "map" && "hidden lg:block",
          )}
        >
          <p className="eyebrow">Jabalpur district</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h1 className="display text-xl">Discover farmland</h1>
            {!loading && (
              <span className="readout text-sm text-ink-faint">
                {parcels.length} result{parcels.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {placeLabel ? `Around ${placeLabel}` : "Around the district centre"}
          </p>

          {/* Place search — keyless geocoding, no API key required */}
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runPlaceSearch();
            }}
          >
            <div className="relative flex-1">
              <MapPin
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="Search a village, tehsil or town"
                aria-label="Search a place"
                className={cn(fieldCls, "w-full pl-9")}
              />
            </div>
            <button
              type="submit"
              disabled={placeBusy || placeQuery.trim().length < 3}
              className="btn btn-primary shrink-0 px-4 py-2"
            >
              {placeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Go
            </button>
            {placeCenter && (
              <button
                type="button"
                onClick={() => {
                  setPlaceCenter(null);
                  setPlaceLabel(null);
                  setPlaceQuery("");
                  setPlaceError(null);
                }}
                className="btn btn-ghost shrink-0 px-3.5 py-2"
              >
                Reset
              </button>
            )}
          </form>
          {placeError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {placeError}
            </p>
          )}

          {/* Filters */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className={fieldCls}
              aria-label="Search radius"
            >
              {[5, 10, 20, 50].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>

            <select
              value={water}
              onChange={(e) => setWater(e.target.value as WaterSource | "any")}
              className={fieldCls}
              aria-label="Water source"
            >
              {WATER_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>

            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={minAcres}
                onChange={(e) => setMinAcres(e.target.value)}
                placeholder="Min ac"
                className={cn(fieldCls, "w-full min-w-0")}
                aria-label="Minimum acres"
              />
              <span className="text-xs text-ink-faint">–</span>
              <input
                type="number"
                min={0}
                value={maxAcres}
                onChange={(e) => setMaxAcres(e.target.value)}
                placeholder="Max ac"
                className={cn(fieldCls, "w-full min-w-0")}
                aria-label="Maximum acres"
              />
            </span>

            <input
              type="number"
              min={0}
              step={500}
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              placeholder="Max ₹/acre"
              className={cn(fieldCls, "w-full")}
              aria-label="Maximum rent per acre per year"
            />

            <input
              type="text"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder="Crop, e.g. Wheat"
              className={cn(fieldCls, "w-full")}
              aria-label="Crop"
            />

            <label
              className={cn(
                fieldCls,
                "flex cursor-pointer select-none items-center gap-2",
                electricity && "border-brand text-brand",
              )}
            >
              <input
                type="checkbox"
                checked={electricity}
                onChange={(e) => setElectricity(e.target.checked)}
                className="accent-[var(--brand)]"
              />
              Electricity
            </label>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={cn(fieldCls, "col-span-2")}
              aria-label="Sort order"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selected parcel strip */}
          {selected && (
            <div
              className="card mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5"
              style={{ borderColor: "var(--gold)", background: "var(--gold-soft)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="display truncate text-md">
                  {selected.village}, {selected.tehsil}
                </p>
                <p className="readout mt-0.5 text-xs text-ink-muted">
                  {selected.ref} · {formatAcres(selected.areaAcres)} ac ·{" "}
                  {formatINR(selected.listing.rentAnnual)}/yr
                </p>
              </div>
              {selected.match && (
                <MatchScore score={selected.match.score} breakdown={selected.match.breakdown} compact />
              )}
              <Link
                href={`/parcel/${selected.id}`}
                className="focus-ring text-sm font-semibold text-brand hover:underline"
              >
                View parcel →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Clear selection"
                className="focus-ring rounded-md p-1 text-ink-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}

          {/* Results */}
          <div ref={listRef} className="mt-5 space-y-4">
            {loading ? (
              <>
                <ParcelCardSkeleton />
                <ParcelCardSkeleton />
                <ParcelCardSkeleton />
                <ParcelCardSkeleton />
              </>
            ) : parcels.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-7 w-7" aria-hidden />}
                title="Nothing in this area yet"
                body="No parcels match these filters. Try widening the radius, or relax a filter to see more land."
              />
            ) : (
              parcels.map((p) => (
                <div
                  key={p.id}
                  id={`parcel-card-${p.id}`}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "cursor-pointer rounded-lg transition-all",
                    selectedId === p.id && "ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-[var(--canvas)]",
                  )}
                >
                  <ParcelCard p={p} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div
          className={cn(
            "min-w-0 flex-1 lg:flex lg:h-[calc(100vh-64px)] lg:flex-col",
            view === "list" && "hidden lg:flex",
          )}
        >
          <DiscoveryMap
            parcels={parcels}
            selectedId={selectedId}
            onSelect={handleMapSelect}
            center={placeCenter ?? JABALPUR}
            radiusKm={radiusKm}
            className="relative h-[calc(100dvh-180px)] w-full lg:min-h-0 lg:flex-1"
          />
          {/* The legend explains the map's pills, so it lives with the map —
              on mobile that means the map view, not the list view. The extra
              bottom padding keeps it clear of the floating view toggle. */}
          <div className="border-t border-line px-5 pb-20 pt-3 lg:pb-3">
            <MapLegend />
          </div>
        </div>
      </div>

      {/* Mobile map/list toggle */}
      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <div className="card flex overflow-hidden rounded-full p-1 shadow-lg">
          <button
            type="button"
            onClick={() => setView("map")}
            className={cn(
              "focus-ring flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              view === "map" ? "bg-brand text-brand-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden /> Map
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "focus-ring flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              view === "list" ? "bg-brand text-brand-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <List className="h-3.5 w-3.5" aria-hidden /> List
          </button>
        </div>
      </div>
    </div>
  );
}
