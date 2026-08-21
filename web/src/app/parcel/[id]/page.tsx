import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { ParcelActions } from "@/components/parcel-actions";
import {
  DocumentList,
  GeometryLadder,
  IdentityBadge,
  VerificationDisclaimer,
} from "@/components/verification";
import { getRepository } from "@/lib/repo";
import { formatAcres, formatDistance, formatINR } from "@/lib/geo";
import { ROAD_LABEL, WATER_LABEL } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const p = await getRepository().byId((await params).id);
  if (!p) return { title: "Parcel not found" };
  return { title: `${formatAcres(p.areaAcres)} acres in ${p.village}` };
}

export async function generateStaticParams() {
  const { seedData } = await import("@/lib/seed");
  return seedData().parcels.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getRepository().byId(id);
  if (!p) notFound();

  const attrs: { label: string; value: string }[] = [
    { label: "Soil", value: p.soilType },
    { label: "Water sources", value: p.waterSources.map((w) => WATER_LABEL[w]).join(", ") },
    {
      label: "Irrigated area",
      value: p.irrigatedAcres
        ? `${formatAcres(p.irrigatedAcres)} of ${formatAcres(p.areaAcres)} acres`
        : "Not irrigated",
    },
    {
      label: "Electricity",
      value: p.electricity ? `Yes · ${p.electricityHours ?? 0} hrs/day` : "No connection",
    },
    {
      label: "Road access",
      value: `${ROAD_LABEL[p.roadAccess]} · ${formatDistance(p.roadDistanceM)} away`,
    },
    { label: "Previous crops", value: p.previousCrops.join(", ") || "—" },
    { label: "Suitable crops", value: p.suitableCrops.join(", ") || "—" },
    {
      label: "Lease term",
      value: `${p.listing.leaseMinYears}–${p.listing.leaseMaxYears} years`,
    },
    { label: "Available from", value: fmtDate(p.listing.availableFrom) },
    { label: "Deposit", value: formatINR(p.listing.deposit) },
    {
      label: "Crop restrictions",
      value: p.listing.cropRestrictions.length ? p.listing.cropRestrictions.join(", ") : "None",
    },
  ];

  const reviewedDocs = p.documents.filter((d) => d.status === "reviewed_by_farmkaro").length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero imagery */}
      <div className="h-[380px] sm:h-[460px]">
        <ParcelOverlayCard
          geometry={p.geometry}
          placeLabel={`${p.village}, ${p.tehsil}`}
          boundaryConfirmed={
            p.geometryStatus === "boundary_walked_by_farmkaro" ||
            p.geometryStatus === "matched_to_cadastral_record"
          }
          pad={1.9}
          pills={[
            { label: "Area", value: `${formatAcres(p.areaAcres)} ac`, at: { x: 0.14, y: 0.12 } },
            { label: "Water", value: WATER_LABEL[p.waterSources[0]], at: { x: 0.86, y: 0.14 } },
            {
              label: "Rent",
              value: `${formatINR(p.listing.rentAnnual, { compact: true })}/yr`,
              at: { x: 0.13, y: 0.82 },
              tone: "accent",
            },
            ...(p.irrigatedAcres
              ? [
                  {
                    label: "Irrigated",
                    value: `${formatAcres(p.irrigatedAcres)} ac`,
                    at: { x: 0.86, y: 0.8 },
                  } as const,
                ]
              : []),
          ]}
        />
      </div>
      <SatelliteAttribution className="mt-2" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Left column */}
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[32px]">
            {formatAcres(p.areaAcres)} acres in {p.village}
          </h1>
          <p className="mt-1.5 font-mono text-[12.5px] tabular-nums muted">
            {p.ref} · Khasra {p.khasraNumber}
            {p.ulpin ? ` · ULPIN ${p.ulpin}` : ""}
          </p>

          <p className="mt-5 max-w-[68ch] text-[15px] leading-[1.65]">{p.listing.description}</p>

          <dl className="mt-7 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {attrs.map((a) => (
              <div key={a.label} className="hairline border-b pb-3">
                <dt className="text-[11px] font-medium uppercase tracking-[0.09em] muted">
                  {a.label}
                </dt>
                <dd className="mt-1 text-[14px] font-medium">{a.value}</dd>
              </div>
            ))}
          </dl>

          {/* Rent comparables */}
          <div className="surface mt-8 rounded-xl border p-5">
            <h2 className="text-[15px] font-semibold tracking-tight">Rent comparables</h2>
            {p.comparables.count > 0 ? (
              <p className="mt-2 text-[14px] leading-[1.6]">
                Based on <strong className="font-semibold">{p.comparables.count}</strong> completed
                lease{p.comparables.count === 1 ? "" : "s"} nearby:{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {formatINR(p.comparables.lowPerAcre)}–{formatINR(p.comparables.highPerAcre)}
                </span>
                /acre/yr
              </p>
            ) : (
              <p className="mt-2 text-[14px] leading-[1.6] muted">
                No completed leases nearby yet — no estimate shown.
              </p>
            )}
            <p className="mt-2 text-[12px] muted">
              Comparables come only from leases completed on FarmKaro. Where none exist, we do not
              invent an estimate.
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {/* Price + CTA */}
          <div className="surface rounded-2xl border p-5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[26px] font-semibold tabular-nums tracking-tight">
                {formatINR(p.listing.rentAnnual)}
              </span>
              <span className="text-[13px] muted">/ year</span>
            </div>
            <p className="mt-1 text-[13px] muted">
              {formatINR(p.listing.rentPerAcre)}/acre · deposit {formatINR(p.listing.deposit)}
            </p>
            <div className="mt-4">
              <ParcelActions
                parcelId={p.id}
                rentAnnual={p.listing.rentAnnual}
                village={p.village}
              />
            </div>
          </div>

          {/* Owner */}
          <div className="surface rounded-2xl border p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] muted">
              Listed by
            </h2>
            <p className="mt-2 text-[15px] font-semibold tracking-tight">{p.owner.name}</p>
            <div className="mt-2">
              <IdentityBadge status={p.owner.identityStatus} />
            </div>
            <p className="mt-3 text-[13px] muted">
              Member since {new Date(p.owner.memberSince).getFullYear()}
            </p>
            {p.owner.ratingCount > 0 && p.owner.rating != null ? (
              <p className="mt-1 text-[13px]">
                {p.owner.completedLeases} completed lease
                {p.owner.completedLeases === 1 ? "" : "s"} ·{" "}
                <span className="font-mono tabular-nums">{p.owner.rating.toFixed(1)}</span> ★ (
                {p.owner.ratingCount})
              </p>
            ) : (
              <p className="mt-1 text-[13px] muted">No completed leases yet</p>
            )}
          </div>

          {/* Verification */}
          <div className="surface rounded-2xl border p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] muted">
              Verification
            </h2>
            <div className="mt-3">
              <GeometryLadder status={p.geometryStatus} />
            </div>
            <h3 className="hairline mt-4 border-t pt-4 text-[13px] font-semibold uppercase tracking-[0.08em] muted">
              Documents · {reviewedDocs} of {p.documents.length} reviewed
            </h3>
            <DocumentList docs={p.documents} />
            <VerificationDisclaimer className="hairline mt-3 border-t pt-4" />
          </div>

          <p className="text-[12px] muted">
            <Link href="/discover" className="focus-ring rounded font-medium hover:underline">
              ← Back to discovery
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
