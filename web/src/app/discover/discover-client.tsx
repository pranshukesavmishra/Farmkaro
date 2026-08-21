"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Map as MapIcon, SearchX, X } from "lucide-react";
import { DiscoveryMap, MapLegend } from "@/components/discovery-map";
import { ParcelCard, ParcelCardSkeleton } from "@/components/parcel-card";
import { MatchScore } from "@/components/match-score";
import { EmptyState } from "@/components/ui";
import { JABALPUR } from "@/lib/seed";
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
        lng: JABALPUR[0],
        lat: JABALPUR[1],
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
  }, [radiusKm, water, minAcres, maxAcres, maxRent, crop, electricity, sort]);

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

  const fieldCls =
    "surface focus-ring rounded-lg border px-2.5 py-2 text-[13px] leading-none";

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="lg:flex">
        {/* Left panel */}
        <div
          className={cn(
            "shrink-0 px-4 pb-24 pt-5 sm:px-6 lg:h-[calc(100vh-86px)] lg:w-[440px] lg:overflow-y-auto lg:pb-8",
            view === "map" && "hidden lg:block",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight">Discover farmland</h1>
            {!loading && (
              <span className="font-mono text-[12px] tabular-nums muted">
                {parcels.length} result{parcels.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] muted">
            {initialQuery
              ? `Searching around “${initialQuery}”, Jabalpur district`
              : "Around Jabalpur district centre"}
          </p>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
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
                className={cn(fieldCls, "w-[74px]")}
                aria-label="Minimum acres"
              />
              <span className="text-[12px] muted">–</span>
              <input
                type="number"
                min={0}
                value={maxAcres}
                onChange={(e) => setMaxAcres(e.target.value)}
                placeholder="Max ac"
                className={cn(fieldCls, "w-[74px]")}
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
              className={cn(fieldCls, "w-[104px]")}
              aria-label="Maximum rent per acre per year"
            />

            <input
              type="text"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder="Crop, e.g. Wheat"
              className={cn(fieldCls, "w-[128px]")}
              aria-label="Crop"
            />

            <label
              className={cn(
                fieldCls,
                "flex cursor-pointer select-none items-center gap-1.5",
                electricity && "border-forest-500/50 text-forest-700 dark:text-forest-300",
              )}
            >
              <input
                type="checkbox"
                checked={electricity}
                onChange={(e) => setElectricity(e.target.checked)}
                className="accent-[#1B6B47]"
              />
              Electricity
            </label>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={fieldCls}
              aria-label="Sort order"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Legend on mobile lives above the list */}
          <div className="mt-4 lg:hidden">
            <MapLegend />
          </div>

          {/* Selected parcel strip */}
          {selected && (
            <div className="surface mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-gold/45 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold tracking-tight">
                  {selected.village}, {selected.tehsil}
                </p>
                <p className="font-mono text-[11.5px] muted">
                  {selected.ref} · {formatAcres(selected.areaAcres)} ac ·{" "}
                  {formatINR(selected.listing.rentAnnual)}/yr
                </p>
              </div>
              {selected.match && (
                <MatchScore score={selected.match.score} breakdown={selected.match.breakdown} compact />
              )}
              <Link
                href={`/parcel/${selected.id}`}
                className="focus-ring rounded-md text-[13px] font-semibold text-forest-700 hover:underline dark:text-forest-300"
              >
                View parcel →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Clear selection"
                className="focus-ring rounded-md p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}

          {/* Results */}
          <div ref={listRef} className="mt-4 space-y-4">
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
                title="No parcels match"
                body="No parcels match — widen the radius or relax a filter."
              />
            ) : (
              parcels.map((p) => (
                <div
                  key={p.id}
                  id={`parcel-card-${p.id}`}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "rounded-2xl transition-shadow",
                    selectedId === p.id && "ring-2 ring-gold",
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
            "min-w-0 flex-1 lg:flex lg:h-[calc(100vh-86px)] lg:flex-col",
            view === "list" && "hidden lg:flex",
          )}
        >
          <DiscoveryMap
            parcels={parcels}
            selectedId={selectedId}
            onSelect={handleMapSelect}
            center={JABALPUR}
            radiusKm={radiusKm}
            className="relative h-[calc(100dvh-180px)] w-full lg:min-h-0 lg:flex-1"
          />
          <div className="hidden px-4 py-2.5 lg:block">
            <MapLegend />
          </div>
        </div>
      </div>

      {/* Mobile map/list toggle */}
      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <div className="surface flex overflow-hidden rounded-full border shadow-lg">
          <button
            type="button"
            onClick={() => setView("map")}
            className={cn(
              "focus-ring flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold",
              view === "map" ? "bg-forest-900 text-white" : "text-[var(--fg-muted)]",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden /> Map
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "focus-ring flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold",
              view === "list" ? "bg-forest-900 text-white" : "text-[var(--fg-muted)]",
            )}
          >
            <List className="h-3.5 w-3.5" aria-hidden /> List
          </button>
        </div>
      </div>
    </div>
  );
}
