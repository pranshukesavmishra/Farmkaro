import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { cn } from "@/lib/cn";

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

/** One line of the survey table: label left, value right, measures in mono. */
interface Row {
  label: string;
  value: string;
  /** The value itself is a measurement, so it is set as instrument output. */
  mono?: boolean;
  /** A measured tail hung off a written value ("Pucca road · 400 m away"). */
  note?: string;
}

function SurveyTable({ rows }: { rows: Row[] }) {
  return (
    <dl className="border-b border-line">
      {rows.map((r) => (
        <div
          key={r.label}
          className="border-t border-line py-4 sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-baseline sm:gap-x-8"
        >
          <dt className="eyebrow">{r.label}</dt>
          <dd className={cn("mt-1.5 text-base sm:mt-0", r.mono && "readout")}>
            {r.value}
            {r.note && (
              <span className="readout ml-2.5 text-sm text-ink-muted">
                <span aria-hidden className="mr-2.5 text-ink-faint">
                  ·
                </span>
                {r.note}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A glass chip floating over the satellite hero. */
function HeroChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "measure" | "rent";
}) {
  return (
    <div className="glass flex items-baseline gap-2.5 rounded-full px-3.5 py-2">
      <dt className="font-mono text-xs uppercase tracking-[0.12em] text-white/60">{label}</dt>
      <dd
        className={cn(
          "text-sm font-semibold text-white",
          tone !== "default" && "readout",
          tone === "rent" && "text-ochre-300",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** A card in the sticky action rail. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card p-5 sm:p-6", className)}>{children}</div>;
}

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getRepository().byId(id);
  if (!p) notFound();

  const landRows: Row[] = [
    { label: "Soil", value: p.soilType },
    { label: "Water sources", value: p.waterSources.map((w) => WATER_LABEL[w]).join(", ") },
    {
      label: "Irrigated area",
      value: p.irrigatedAcres
        ? `${formatAcres(p.irrigatedAcres)} of ${formatAcres(p.areaAcres)} acres`
        : "Not irrigated",
      mono: Boolean(p.irrigatedAcres),
    },
    {
      label: "Electricity",
      value: p.electricity ? "Yes" : "No connection",
      note: p.electricity ? `${p.electricityHours ?? 0} hrs/day` : undefined,
    },
    {
      label: "Road access",
      value: ROAD_LABEL[p.roadAccess],
      note: `${formatDistance(p.roadDistanceM)} away`,
    },
    { label: "Previous crops", value: p.previousCrops.join(", ") || "—" },
    { label: "Suitable crops", value: p.suitableCrops.join(", ") || "—" },
  ];

  const leaseRows: Row[] = [
    {
      label: "Lease term",
      value: `${p.listing.leaseMinYears}–${p.listing.leaseMaxYears} years`,
      mono: true,
    },
    { label: "Available from", value: fmtDate(p.listing.availableFrom), mono: true },
    { label: "Deposit", value: formatINR(p.listing.deposit), mono: true },
    {
      label: "Crop restrictions",
      value: p.listing.cropRestrictions.length ? p.listing.cropRestrictions.join(", ") : "None",
    },
  ];

  const reviewedDocs = p.documents.filter((d) => d.status === "reviewed_by_farmkaro").length;

  // Comparable band. The domain stretches to include this listing's own rent so
  // an asking price outside the transacted range is shown honestly, not clamped
  // back inside it.
  const c = p.comparables;
  const ask = p.listing.rentPerAcre;
  const domainMin = Math.min(c.lowPerAcre, ask);
  const domainMax = Math.max(c.highPerAcre, ask);
  const span = Math.max(1, domainMax - domainMin);
  const at = (v: number) => ((v - domainMin) / span) * 100;

  return (
    <article>
      {/* ── Hero: the land itself, edge to edge ─────────────────────────────── */}
      <section className="relative isolate flex min-h-[440px] flex-col overflow-hidden sm:min-h-[560px]">
        <div className="absolute inset-0 -z-10">
          <ParcelOverlayCard
            geometry={p.geometry}
            placeLabel={`${p.village}, ${p.tehsil}`}
            boundaryConfirmed={
              p.geometryStatus === "boundary_walked_by_farmkaro" ||
              p.geometryStatus === "matched_to_cadastral_record"
            }
            pad={2.6}
            rounded="rounded-none"
            className="h-full w-full"
          />
        </div>

        {/* Scrim: type stays legible, the land still reads through it. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to top, var(--canvas) 0%, color-mix(in srgb, var(--canvas) 74%, transparent) 22%, color-mix(in srgb, var(--canvas) 12%, transparent) 52%, transparent 78%)",
          }}
        />

        <div className="mx-auto flex w-full max-w-shell flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pb-14">
          <Link
            href="/discover"
            className="glass focus-ring inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Discovery map
          </Link>

          <div className="mt-auto pt-20">
            <p
              className="fade-in font-mono text-xs uppercase tracking-[0.14em] text-white/65"
              style={{ animationDelay: "80ms" }}
            >
              {p.tehsil} tehsil · {p.district}, {p.state}
            </p>

            <h1
              className="display rise mt-3 max-w-[16ch] text-2xl text-white"
              style={{ animationDelay: "120ms", textShadow: "0 2px 28px rgba(0,0,0,0.45)" }}
            >
              {p.village}
            </h1>

            <p
              className="readout fade-in mt-3 text-sm text-white/70"
              style={{ animationDelay: "180ms" }}
            >
              {p.ref} · Khasra {p.khasraNumber}
              {p.ulpin ? ` · ULPIN ${p.ulpin}` : ""}
            </p>

            <dl
              className="rise mt-7 flex flex-wrap gap-2"
              style={{ animationDelay: "220ms" }}
            >
              <HeroChip label="Area" value={`${formatAcres(p.areaAcres)} ac`} tone="measure" />
              <HeroChip
                label="Rent"
                value={`${formatINR(p.listing.rentAnnual, { compact: true })}/yr`}
                tone="rent"
              />
              <HeroChip label="Water" value={p.waterSources.map((w) => WATER_LABEL[w]).join(" + ")} />
              {p.irrigatedAcres ? (
                <HeroChip
                  label="Irrigated"
                  value={`${formatAcres(p.irrigatedAcres)} ac`}
                  tone="measure"
                />
              ) : null}
              <HeroChip label="Road" value={ROAD_LABEL[p.roadAccess]} />
            </dl>
          </div>
        </div>
      </section>

      {/* ── Body: the story and the data, beside the desk ───────────────────── */}
      <div className="mx-auto max-w-shell px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-10">
        <SatelliteAttribution className="text-xs text-ink-faint" />

        <div className="mt-10 grid gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)]">
          {/* Left — the record */}
          <div className="min-w-0 space-y-14 sm:space-y-16">
            <section className="rise">
              <h2 className="eyebrow">Description</h2>
              <p className="mt-3 max-w-prose text-md leading-relaxed">{p.listing.description}</p>
            </section>

            <section className="rise" style={{ animationDelay: "60ms" }}>
              <h2 className="display text-lg">The land</h2>
              <div className="mt-5">
                <SurveyTable rows={landRows} />
              </div>
            </section>

            <section className="rise" style={{ animationDelay: "110ms" }}>
              <h2 className="display text-lg">Lease terms</h2>
              <div className="mt-5">
                <SurveyTable rows={leaseRows} />
              </div>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
                Executed under the state framework: a fixed term, possession reverting on expiry,
                and no tenancy or occupancy rights created.
              </p>
            </section>

            {/* Rent comparables — wording unchanged, on purpose. */}
            <section className="card ticks rise p-5 sm:p-7" style={{ animationDelay: "160ms" }}>
              <p className="eyebrow">Market</p>
              <h2 className="display mt-2 text-lg">Rent comparables</h2>

              {c.count > 0 ? (
                <>
                  <p className="mt-4 max-w-prose text-md leading-relaxed">
                    Based on <strong className="readout font-semibold">{c.count}</strong> completed
                    lease{c.count === 1 ? "" : "s"} nearby:{" "}
                    <span className="readout font-semibold text-gold">
                      {formatINR(c.lowPerAcre)}–{formatINR(c.highPerAcre)}
                    </span>
                    /acre/yr
                  </p>

                  {/* The transacted band, with this listing marked on the same
                      scale. Both endpoints are real; nothing is interpolated. */}
                  <div className="mt-7">
                    <div className="relative h-1.5 rounded-full bg-line">
                      <div
                        className="absolute inset-y-0 rounded-full bg-gold"
                        style={{ left: `${at(c.lowPerAcre)}%`, right: `${100 - at(c.highPerAcre)}%` }}
                      />
                      <div
                        aria-hidden
                        className="absolute -top-1.5 h-[18px] w-[2px] rounded-full bg-brand"
                        style={{ left: `${at(ask)}%`, transform: "translateX(-50%)" }}
                      />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-4">
                      <span className="readout text-xs text-ink-faint">
                        {formatINR(domainMin)}/ac
                      </span>
                      <span className="readout text-xs text-ink-faint">
                        {formatINR(domainMax)}/ac
                      </span>
                    </div>

                    <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-1.5 w-5 rounded-full bg-gold" />
                        Completed leases nearby
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-3 w-[2px] rounded-full bg-brand" />
                        This listing asks{" "}
                        <span className="readout text-ink">{formatINR(ask)}</span>/ac
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-4 max-w-prose text-md leading-relaxed text-ink-muted">
                  No completed leases nearby yet — no estimate shown.
                </p>
              )}

              <p className="mt-5 max-w-prose border-t border-line pt-4 text-sm leading-relaxed text-ink-muted">
                Comparables come only from leases completed on FarmKaro. Where none exist, we do not
                invent an estimate.
              </p>
            </section>
          </div>

          {/* Right — the action rail */}
          <aside className="thin-scroll space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            {/* Price + CTA */}
            <Panel className="ticks">
              <p className="eyebrow">Asking rent</p>
              <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
                <span className="readout text-xl font-semibold">
                  {formatINR(p.listing.rentAnnual)}
                </span>
                <span className="text-sm text-ink-muted">/ year</span>
              </p>

              <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Per acre</dt>
                  <dd className="readout font-medium">{formatINR(p.listing.rentPerAcre)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Deposit</dt>
                  <dd className="readout font-medium">{formatINR(p.listing.deposit)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Available from</dt>
                  <dd className="readout font-medium">{fmtDate(p.listing.availableFrom)}</dd>
                </div>
              </dl>

              <div className="mt-5">
                <ParcelActions
                  parcelId={p.id}
                  rentAnnual={p.listing.rentAnnual}
                  village={p.village}
                />
              </div>
            </Panel>

            {/* Owner */}
            <Panel>
              <p className="eyebrow">Listed by</p>
              <h2 className="display mt-2 text-md">{p.owner.name}</h2>
              <div className="mt-3">
                <IdentityBadge status={p.owner.identityStatus} />
              </div>

              <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Member since</dt>
                  <dd className="readout font-medium">
                    {new Date(p.owner.memberSince).getFullYear()}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Completed leases</dt>
                  <dd className="readout font-medium">{p.owner.completedLeases}</dd>
                </div>
                {p.owner.ratingCount > 0 && p.owner.rating != null ? (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-muted">Rating</dt>
                    <dd className="readout font-medium">
                      {p.owner.rating.toFixed(1)} ★{" "}
                      <span className="text-ink-faint">({p.owner.ratingCount})</span>
                    </dd>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-muted">Rating</dt>
                    <dd className="text-ink-faint">No completed leases yet</dd>
                  </div>
                )}
              </dl>
            </Panel>

            {/* Verification ladder + documents — copy unchanged, on purpose. */}
            <Panel>
              <p className="eyebrow">Where this parcel stands</p>
              <h2 className="display mt-2 text-md">Verification</h2>

              <div className="mt-3">
                <GeometryLadder status={p.geometryStatus} />
              </div>

              <h3 className="eyebrow mt-4 border-t border-line pt-4">
                Documents · <span className="readout">{reviewedDocs}</span> of{" "}
                <span className="readout">{p.documents.length}</span> reviewed
              </h3>
              <div className="mt-1">
                <DocumentList docs={p.documents} />
              </div>

              <VerificationDisclaimer className="mt-4 border-t border-line pt-4" />
            </Panel>

            <p>
              <Link
                href="/discover"
                className="focus-ring inline-flex items-center gap-2 rounded text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to discovery
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </article>
  );
}
