import Link from "next/link";
import { Droplets, Route, Zap } from "lucide-react";
import { ParcelOverlayCard } from "./parcel-overlay-card";
import { MatchScore } from "./match-score";
import { formatAcres, formatDistance, formatINR } from "@/lib/geo";
import { GEOMETRY_LABEL, ROAD_LABEL, WATER_LABEL, type ParcelView } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * A parcel as a survey card: imagery on top, then a measured readout. Rent and
 * area are monospace because they are data the reader compares across cards.
 */
export function ParcelCard({
  p,
  showMatch = true,
  className,
}: {
  p: ParcelView;
  showMatch?: boolean;
  className?: string;
}) {
  const irrigated = !p.waterSources.includes("rainfed");

  return (
    <article className={cn("card card-lift group relative overflow-hidden", className)}>
      <div className="relative h-[176px] overflow-hidden">
        <ParcelOverlayCard
          geometry={p.geometry}
          rounded="rounded-none"
          pad={2.3}
          pills={
            p.distanceM != null
              ? [{ label: "Away", value: formatDistance(p.distanceM), at: { x: 0.79, y: 0.12 } }]
              : []
          }
        />
        {showMatch && p.match && (
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <MatchScore score={p.match.score} breakdown={p.match.breakdown} compact />
          </div>
        )}
      </div>

      <div className="space-y-3.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display truncate text-md">
              <Link href={`/parcel/${p.id}`} className="stretch-link focus-ring hover:text-brand">
                {p.village}
              </Link>
            </h3>
            <p className="readout mt-0.5 text-xs text-ink-faint">
              {p.ref} · Khasra {p.khasraNumber}
            </p>
          </div>
          <p className="readout shrink-0 text-md font-semibold">{formatAcres(p.areaAcres)} ac</p>
        </div>

        <div className="flex items-baseline gap-2 border-t border-line pt-3.5">
          <span className="readout text-lg font-semibold text-ink">
            {formatINR(p.listing.rentAnnual)}
          </span>
          <span className="text-sm text-ink-muted">/ year</span>
          <span className="readout ml-auto text-xs text-ink-faint">
            {formatINR(p.listing.rentPerAcre)}/ac
          </span>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
          <li className="inline-flex items-center gap-1.5">
            <Droplets
              className={cn("h-3.5 w-3.5", irrigated ? "text-brand" : "text-ink-faint")}
              aria-hidden
            />
            {p.waterSources.map((w) => WATER_LABEL[w]).join(" + ")}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Zap
              className={cn("h-3.5 w-3.5", p.electricity ? "text-brand" : "text-ink-faint")}
              aria-hidden
            />
            {p.electricity ? `${p.electricityHours ?? 0} hrs power` : "No power"}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            {ROAD_LABEL[p.roadAccess]}
          </li>
        </ul>

        <p className="border-t border-line pt-3 text-xs text-ink-faint">
          {GEOMETRY_LABEL[p.geometryStatus]}
        </p>
      </div>
    </article>
  );
}

export function ParcelCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="relative h-[176px] overflow-hidden bg-surface-2">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-surface-2" />
        <div className="h-5 w-1/2 rounded bg-surface-2" />
        <div className="h-3 w-full rounded bg-surface-2" />
      </div>
    </div>
  );
}
