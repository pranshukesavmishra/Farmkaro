import Link from "next/link";
import { Droplets, Route, Zap } from "lucide-react";
import { ParcelOverlayCard } from "./parcel-overlay-card";
import { MatchScore } from "./match-score";
import { Badge } from "./ui";
import { formatAcres, formatDistance, formatINR } from "@/lib/geo";
import { ROAD_LABEL, WATER_LABEL, type ParcelView } from "@/lib/types";
import { cn } from "@/lib/cn";

export function ParcelCard({
  p,
  showMatch = true,
  className,
}: {
  p: ParcelView;
  showMatch?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "surface group overflow-hidden rounded-2xl border transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(0,54,34,.55)]",
        className,
      )}
    >
      <div className="relative h-[188px]">
        <ParcelOverlayCard
          geometry={p.geometry}
          href={`/parcel/${p.id}`}
          rounded="rounded-none"
          placeLabel={undefined}
          pills={[
            { label: "Area", value: `${formatAcres(p.areaAcres)} ac`, at: { x: 0.19, y: 0.13 } },
            ...(p.distanceM != null
              ? [{ label: "Away", value: formatDistance(p.distanceM), at: { x: 0.81, y: 0.13 } } as const]
              : []),
          ]}
        />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              <Link href={`/parcel/${p.id}`} className="focus-ring rounded">
                {p.village}, {p.tehsil}
              </Link>
            </h3>
            <p className="mt-0.5 font-mono text-[11.5px] muted">
              {p.ref} · Khasra {p.khasraNumber}
            </p>
          </div>
          {showMatch && p.match && (
            <MatchScore score={p.match.score} breakdown={p.match.breakdown} compact />
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-mono text-[19px] font-semibold tabular-nums tracking-tight">
            {formatINR(p.listing.rentAnnual)}
          </span>
          <span className="text-[12.5px] muted">/ year</span>
          <span className="text-[12.5px] muted">
            · {formatINR(p.listing.rentPerAcre)}/acre
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone={p.waterSources.includes("rainfed") ? "muted" : "good"}>
            <Droplets className="h-3 w-3" aria-hidden />
            {p.waterSources.map((w) => WATER_LABEL[w]).join(" + ")}
          </Badge>
          <Badge tone={p.electricity ? "good" : "muted"}>
            <Zap className="h-3 w-3" aria-hidden />
            {p.electricity ? `Power · ${p.electricityHours ?? 0} hrs` : "No power"}
          </Badge>
          <Badge tone={p.roadAccess === "none" ? "muted" : "neutral"}>
            <Route className="h-3 w-3" aria-hidden />
            {ROAD_LABEL[p.roadAccess]}
          </Badge>
        </div>
      </div>
    </article>
  );
}

export function ParcelCardSkeleton() {
  return (
    <div className="surface overflow-hidden rounded-2xl border">
      <div className="h-[188px] animate-pulse bg-[var(--line)]/60" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--line)]/60" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-[var(--line)]/60" />
        <div className="flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--line)]/60" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--line)]/60" />
        </div>
      </div>
    </div>
  );
}
