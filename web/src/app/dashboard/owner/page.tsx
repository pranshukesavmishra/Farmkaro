import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { LiveDeals } from "@/components/live-deals";
import { ClaimOwner } from "@/components/claim-owner";
import { getRepository } from "@/lib/repo";
import { formatAcres, formatINR } from "@/lib/geo";
import { GEOMETRY_LABEL, REGISTRATION_LABEL, type Lease } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Landowner dashboard" };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const NO_TENANCY =
  "Leases executed under the state land-leasing framework do not create tenancy or occupancy rights; possession reverts on expiry.";

/* --------------------------------------------------------------------------
 * Local chrome. Deliberately quiet: on this page the satellite imagery is the
 * only saturated thing, and everything else reads as instrumentation around it.
 * ------------------------------------------------------------------------ */

type PillTone = "good" | "pending" | "neutral" | "muted";

const PILL_TONE: Record<PillTone, string> = {
  good: "border-line-strong bg-surface-2 text-positive",
  pending: "border-line-strong bg-gold-soft text-gold",
  neutral: "border-line-strong bg-surface-2 text-ink-muted",
  muted: "border-line bg-surface-2 text-ink-faint",
};

/** A status pill: a dot and a word. No colour beyond what the status means. */
function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        PILL_TONE[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
      {children}
    </span>
  );
}

/** One gauge in the instrument row: label above, measured value below. */
function Readout({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent" | "warn";
}) {
  return (
    <div className="flex min-h-[124px] flex-col bg-surface px-5 py-5 sm:px-6">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          "readout mt-auto pt-5 text-xl font-semibold leading-none",
          tone === "accent" && "text-brand",
          tone === "warn" && "text-gold",
        )}
      >
        {value}
      </dd>
      {sub && <dd className="mt-2 text-xs leading-snug text-ink-faint">{sub}</dd>}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display mt-2 text-xl">{title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      {aside}
    </div>
  );
}

function registrationTone(s: Lease["registrationStatus"]): PillTone {
  switch (s) {
    case "registered":
      return "good";
    case "submitted_for_registration":
      return "pending";
    case "stamped":
      return "neutral";
    default:
      return "muted";
  }
}

function leaseStatusTone(s: Lease["status"]): PillTone {
  switch (s) {
    case "active":
      return "good";
    case "expiring":
      return "pending";
    case "signed":
      return "neutral";
    default:
      return "muted";
  }
}

export default async function OwnerDashboardPage() {
  const repo = getRepository();
  const [parcels, leases] = await Promise.all([repo.byOwner("own-1"), repo.leases()]);

  const activeListings = parcels.filter((p) => p.listing.status === "active").length;
  const activeLeases = leases.filter((l) => l.status === "active");
  const rentUnderLease = activeLeases.reduce((s, l) => s + l.rentAnnual, 0);
  const expiringSoon = leases.filter((l) => l.status === "expiring").length;
  const nextPayments = leases
    .filter((l) => l.nextPaymentDue)
    .sort((a, b) => (a.nextPaymentDue! < b.nextPaymentDue! ? -1 : 1));

  const totalAcres = parcels.reduce((s, p) => s + p.areaAcres, 0);

  return (
    <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pt-12">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 rise">
        <div>
          <p className="eyebrow">Landowner control panel</p>
          <h1 className="display mt-2.5 max-w-[16ch] text-2xl">Landowner dashboard</h1>
          <p className="mt-3 max-w-prose text-md leading-relaxed text-ink-muted">
            Your parcels, leases and verification, in one place.
          </p>
        </div>
        <Link href="/list-land" className="btn btn-ghost">
          List a parcel <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {/* Live desk and pilot claim — unchanged, and kept above the readouts so
          real activity is always the first thing acted on. */}
      <div className="mt-9">
        <ClaimOwner />
        <LiveDeals mode="owner" />
      </div>

      {/* ── Instrument row ───────────────────────────────────────────────────── */}
      <dl
        className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5 rise"
        style={{ animationDelay: "80ms" }}
      >
        <Readout
          label="Total parcels"
          value={String(parcels.length)}
          sub={`${formatAcres(totalAcres)} acres in all`}
        />
        <Readout
          label="Active listings"
          value={String(activeListings)}
          tone="accent"
          sub="published, open to offers"
        />
        <Readout label="Executed leases" value={String(leases.length)} sub="signed, active or completed" />
        <Readout
          label="Rent under lease"
          value={formatINR(rentUnderLease, { compact: true })}
          sub="per year, active leases"
        />
        <Readout
          label="Expiring soon"
          value={String(expiringSoon)}
          tone={expiringSoon > 0 ? "warn" : "default"}
          sub={expiringSoon > 0 ? "leases marked expiring" : "no lease marked expiring"}
        />
        {/* Completes the panel rectangle when the row wraps. */}
        <div className="bg-surface lg:hidden" aria-hidden />
      </dl>

      {/* ── Parcels ──────────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Holdings"
          title="Your parcels"
          description="Each parcel shows the exact verification rung it has reached — nothing is marked verified until it is."
          aside={
            parcels.length > 0 ? (
              <p className="readout text-xs text-ink-faint">
                {parcels.length} parcels · {formatAcres(totalAcres)} ac
              </p>
            ) : undefined
          }
        />

        {parcels.length === 0 ? (
          <p className="card grid-paper px-6 py-16 text-center text-sm text-ink-muted">
            No parcels on this account yet. Listing is free for landowners —{" "}
            <Link href="/list-land" className="focus-ring font-semibold text-brand hover:underline">
              add your first parcel
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {parcels.map((p, i) => {
                const reviewed = p.documents.filter(
                  (d) => d.status === "reviewed_by_farmkaro",
                ).length;
                const surveyed =
                  p.geometryStatus === "boundary_walked_by_farmkaro" ||
                  p.geometryStatus === "matched_to_cadastral_record";

                return (
                  <article
                    key={p.id}
                    className="card card-lift group overflow-hidden rise"
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <div className="relative h-[176px] overflow-hidden">
                      <ParcelOverlayCard
                        geometry={p.geometry}
                        href={`/parcel/${p.id}`}
                        rounded="rounded-none"
                        pad={2.3}
                        pills={[
                          {
                            label: "Area",
                            value: `${formatAcres(p.areaAcres)} ac`,
                            at: { x: 0.24, y: 0.14 },
                          },
                          {
                            label: "Rent",
                            value: `${formatINR(p.listing.rentAnnual, { compact: true })}/yr`,
                            at: { x: 0.72, y: 0.14 },
                            tone: "gold",
                          },
                        ]}
                      />
                      {p.listing.status !== "active" && (
                        <div className="pointer-events-none absolute bottom-3 right-3 z-10">
                          <span className="glass rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">
                            {p.listing.status}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3.5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="display truncate text-md">
                            <Link href={`/parcel/${p.id}`} className="focus-ring hover:text-brand">
                              {p.village}
                            </Link>
                          </h3>
                          <p className="mt-0.5 font-mono text-xs text-ink-faint">
                            {p.ref} · Khasra {p.khasraNumber}
                          </p>
                        </div>
                        <p className="readout shrink-0 text-md font-semibold">
                          {formatAcres(p.areaAcres)} ac
                        </p>
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

                      <div className="space-y-2.5 border-t border-line pt-3.5">
                        <p className="flex items-start gap-2 text-xs leading-snug text-ink-muted">
                          <span
                            className={cn(
                              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                              surveyed ? "bg-positive" : "bg-ink-faint",
                            )}
                            aria-hidden
                          />
                          {GEOMETRY_LABEL[p.geometryStatus]}
                        </p>

                        <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
                          <span>Documents reviewed</span>
                          <span className="readout">
                            {reviewed}/{p.documents.length}
                          </span>
                        </div>
                        {/* One tick per document, filled as it clears review. */}
                        <div className="flex gap-1" aria-hidden>
                          {p.documents.map((d) => (
                            <span
                              key={d.id}
                              className={cn(
                                "h-1 flex-1 rounded-full",
                                d.status === "reviewed_by_farmkaro"
                                  ? "bg-brand"
                                  : d.status === "under_review"
                                    ? "bg-gold"
                                    : "bg-line-strong",
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <Link
                        href={`/parcel/${p.id}`}
                        className="focus-ring inline-flex items-center gap-1.5 rounded pt-0.5 text-sm font-semibold text-brand transition-[gap] hover:gap-2.5"
                      >
                        Open parcel <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            <SatelliteAttribution className="mt-6" />
          </>
        )}
      </section>

      {/* ── Leases ───────────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Executed agreements"
          title="Leases"
          description="Registration status is shown exactly as recorded — a stamped lease is not a registered one."
          aside={
            leases.length > 0 ? (
              <p className="readout text-xs text-ink-faint">
                {activeLeases.length} active of {leases.length}
              </p>
            ) : undefined
          }
        />

        <div className="card overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Ref
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Parcel
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Lessee
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Period
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 text-right font-medium">
                    Rent / yr
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Registration
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-ink-muted">
                      No leases executed yet.
                    </td>
                  </tr>
                ) : (
                  leases.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-surface-2">
                      <td className="readout whitespace-nowrap px-5 py-4 text-xs text-ink-muted">
                        {l.ref}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <Link
                          href={`/parcel/${l.parcelId}`}
                          className="focus-ring rounded font-medium text-ink hover:text-brand"
                        >
                          {l.village}
                        </Link>
                        <span className="readout ml-2 text-xs text-ink-faint">{l.parcelRef}</span>
                      </td>
                      <td className="px-5 py-4 text-ink-muted">{l.lesseeName}</td>
                      <td className="readout whitespace-nowrap px-5 py-4 text-xs text-ink-muted">
                        {fmtDate(l.startDate)}
                        <span className="mx-1.5 text-ink-faint" aria-hidden>
                          →
                        </span>
                        {fmtDate(l.endDate)}
                      </td>
                      <td className="readout whitespace-nowrap px-5 py-4 text-right font-semibold text-ink">
                        {formatINR(l.rentAnnual)}
                      </td>
                      <td className="px-5 py-4">
                        <Pill tone={registrationTone(l.registrationStatus)}>
                          {REGISTRATION_LABEL[l.registrationStatus]}
                        </Pill>
                      </td>
                      <td className="px-5 py-4">
                        <Pill tone={leaseStatusTone(l.status)} className="capitalize">
                          {l.status}
                        </Pill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-faint">{NO_TENANCY}</p>
      </section>

      {/* ── Rent schedule ────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Rent schedule"
          title="Next payments"
          description="Upcoming rent instalments across your leases."
        />

        {nextPayments.length === 0 ? (
          <p className="card px-6 py-14 text-center text-sm text-ink-muted">
            No instalments scheduled.
          </p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {nextPayments.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{l.lesseeName}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    <span className="readout">{l.ref}</span> · {l.village}
                  </p>
                </div>
                <div className="ml-auto flex items-baseline gap-6 sm:gap-10">
                  <span className="readout whitespace-nowrap text-xs text-ink-muted">
                    Due {fmtDate(l.nextPaymentDue!)}
                  </span>
                  <span className="readout min-w-[7rem] text-right text-md font-semibold text-ink">
                    {formatINR(l.nextPaymentAmount ?? 0)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
