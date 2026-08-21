import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { ParcelCard } from "@/components/parcel-card";
import { MatchScore } from "@/components/match-score";
import { LiveDeals } from "@/components/live-deals";
import { getRepository } from "@/lib/repo";
import { JABALPUR } from "@/lib/seed";
import { formatAcres, formatINR } from "@/lib/geo";
import { REGISTRATION_LABEL, WATER_LABEL, type Lease } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Cultivator dashboard" };

const MY_NAMES = ["Ajay Patel", "Rakesh Kushwaha"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const NO_TENANCY =
  "Leases executed under the state land-leasing framework do not create tenancy or occupancy rights; possession reverts on expiry.";

/* --------------------------------------------------------------------------
 * Local chrome. Deliberately quiet: the satellite imagery is the only
 * saturated thing on the page, and everything else reads as instrumentation
 * arranged around it.
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
  dot = true,
  children,
  className,
}: {
  tone?: PillTone;
  dot?: boolean;
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
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}

/** A stated preference, set as a labelled instrument reading. */
function PrefChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface-2 py-1.5 pl-3 pr-3.5">
      <span className="eyebrow">{label}</span>
      <span className="readout text-xs font-semibold text-ink">{value}</span>
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

export default async function FarmerDashboardPage() {
  const repo = getRepository();
  const [results, browsed, allLeases] = await Promise.all([
    repo.search({
      lng: JABALPUR[0],
      lat: JABALPUR[1],
      radiusKm: 25,
      crop: "Wheat",
      maxRentPerAcre: 20000,
      limit: 6,
      sort: "match",
    }),
    // Broader pass around the same centre stands in for the user's bookmarks.
    repo.search({ lng: JABALPUR[0], lat: JABALPUR[1], radiusKm: 25, limit: 8, sort: "match" }),
    repo.leases(),
  ]);

  const recommended = results.slice(0, 3);
  const recIds = new Set(recommended.map((p) => p.id));
  const saved = browsed.filter((p) => !recIds.has(p.id)).slice(0, 3);
  const [top, ...restRecommended] = recommended;
  const myLeases = allLeases.filter((l) => MY_NAMES.includes(l.lesseeName));
  const myPayments = myLeases
    .filter((l) => l.nextPaymentDue)
    .sort((a, b) => (a.nextPaymentDue! < b.nextPaymentDue! ? -1 : 1));

  const activeLeases = myLeases.filter((l) => l.status === "active");
  const rentCommitted = activeLeases.reduce((s, l) => s + l.rentAnnual, 0);
  const leasedAcres = activeLeases.reduce((s, l) => s + l.areaAcres, 0);
  const nextDue = myPayments[0];

  return (
    <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pt-12">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 rise">
        <div>
          <p className="eyebrow">Cultivator control panel</p>
          <h1 className="display mt-2.5 text-2xl">Cultivator dashboard</h1>
          <p className="mt-3 max-w-prose text-md leading-relaxed text-ink-muted">
            Land matched to your preferences, your leases and your payment schedule.
          </p>
        </div>
        <Link href="/discover" className="btn btn-ghost">
          Open the map <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {/* The live deal desk stays first: real, signed-in activity is always the
          thing you act on before any sample content below it. */}
      <div className="mt-9">
        <LiveDeals mode="farmer" />
      </div>

      {/* ── Instrument row ───────────────────────────────────────────────────── */}
      <dl
        className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5 rise"
        style={{ animationDelay: "80ms" }}
      >
        <Readout
          label="Matches found"
          value={String(results.length)}
          tone="accent"
          sub="within your stated preferences"
        />
        <Readout
          label="Saved parcels"
          value={String(saved.length)}
          sub="kept aside while exploring"
        />
        <Readout
          label="Active leases"
          value={String(activeLeases.length)}
          sub={
            activeLeases.length > 0
              ? `${formatAcres(leasedAcres)} acres under cultivation`
              : `${myLeases.length} executed in all`
          }
        />
        <Readout
          label="Rent committed"
          value={formatINR(rentCommitted, { compact: true })}
          sub="per year, active leases"
        />
        <Readout
          label="Next instalment"
          value={nextDue ? formatINR(nextDue.nextPaymentAmount ?? 0, { compact: true }) : "—"}
          tone={nextDue ? "warn" : "default"}
          sub={nextDue ? `due ${fmtDate(nextDue.nextPaymentDue!)}` : "nothing scheduled"}
        />
        {/* Completes the panel rectangle when the row wraps. */}
        <div className="bg-surface lg:hidden" aria-hidden />
      </dl>

      {/* ── Recommended ──────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Matched to your preferences"
          title="Recommended for you"
          description="Scores are computed from your stated preferences — every component is a plain rule you can inspect."
          aside={
            <Pill tone="pending" dot={false}>
              <Sparkles className="h-3 w-3" aria-hidden />
              Explainable matches
            </Pill>
          }
        />

        {/* Stated preferences, read back as instrument settings. */}
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <span className="text-sm text-ink-muted">Searching for</span>
          <PrefChip label="Crop" value="Wheat" />
          <PrefChip label="Max rent" value="₹20,000/ac" />
          <PrefChip label="Radius" value="25 km · Jabalpur" />
          <Link
            href="/discover?radiusKm=25"
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm font-semibold text-brand transition-[gap] hover:gap-2.5"
          >
            Adjust in Discover <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {top ? (
          <article className="card overflow-hidden rise" style={{ animationDelay: "60ms" }}>
            <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              {/* Imagery: the loudest thing on the page, by design. */}
              <div className="relative min-h-[300px] sm:min-h-[380px] lg:min-h-[500px]">
                <div className="absolute inset-0">
                  <ParcelOverlayCard
                    geometry={top.geometry}
                    href={`/parcel/${top.id}`}
                    rounded="rounded-none"
                    className="h-full w-full"
                    priorityLabel="Top match"
                    placeLabel={`${top.village}, ${top.tehsil}`}
                    pills={[
                      {
                        label: "Area",
                        value: `${formatAcres(top.areaAcres)} ac`,
                        at: { x: 0.2, y: 0.16 },
                      },
                      {
                        label: "Water",
                        value: WATER_LABEL[top.waterSources[0]],
                        at: { x: 0.79, y: 0.2 },
                      },
                      {
                        label: "Rent",
                        value: `${formatINR(top.listing.rentPerAcre)}/ac`,
                        at: { x: 0.24, y: 0.79 },
                        tone: "gold",
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Readout column: what it is, what it costs, and why it scored. */}
              <div className="ticks relative flex flex-col gap-5 border-t border-line p-5 sm:p-6 lg:border-l lg:border-t-0">
                <div>
                  <p className="eyebrow">Best match today</p>
                  <h3 className="display mt-2 text-lg">
                    <Link href={`/parcel/${top.id}`} className="focus-ring hover:text-brand">
                      {formatAcres(top.areaAcres)} acres in {top.village}
                    </Link>
                  </h3>
                  <p className="readout mt-1.5 text-xs text-ink-faint">
                    {top.ref} · Khasra {top.khasraNumber} · {top.tehsil}
                  </p>
                </div>

                <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                  <div className="bg-surface-2 px-3 py-3">
                    <dt className="eyebrow">Area</dt>
                    <dd className="readout mt-2 text-md font-semibold">
                      {formatAcres(top.areaAcres)} ac
                    </dd>
                  </div>
                  <div className="bg-surface-2 px-3 py-3">
                    <dt className="eyebrow">Rent / yr</dt>
                    <dd className="readout mt-2 text-md font-semibold">
                      {formatINR(top.listing.rentAnnual, { compact: true })}
                    </dd>
                  </div>
                  <div className="bg-surface-2 px-3 py-3">
                    <dt className="eyebrow">Per acre</dt>
                    <dd className="readout mt-2 text-md font-semibold">
                      {formatINR(top.listing.rentPerAcre)}
                    </dd>
                  </div>
                </dl>

                {top.match && (
                  <MatchScore score={top.match.score} breakdown={top.match.breakdown} />
                )}

                <Link href={`/parcel/${top.id}`} className="btn btn-primary mt-auto self-start">
                  Open parcel <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </article>
        ) : (
          <div className="card grid-paper px-6 py-16 text-center">
            <h3 className="display text-lg">No recommendations yet</h3>
            <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
              No parcels match your preferences right now — widen the radius or relax a filter in{" "}
              <Link href="/discover" className="focus-ring font-semibold text-brand hover:underline">
                Discover
              </Link>
              .
            </p>
          </div>
        )}

        {restRecommended.length > 0 && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {restRecommended.map((p, i) => (
              <div key={p.id} className="rise" style={{ animationDelay: `${120 + i * 55}ms` }}>
                <ParcelCard p={p} />
              </div>
            ))}
          </div>
        )}

        <SatelliteAttribution className="mt-6" />
      </section>

      {/* ── Saved ────────────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Kept aside"
          title="Saved parcels"
          description="Parcels you bookmarked while exploring."
          aside={
            saved.length > 0 ? (
              <p className="readout text-xs text-ink-faint">{saved.length} saved</p>
            ) : undefined
          }
        />

        {saved.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((p, i) => (
              <div key={p.id} className="rise" style={{ animationDelay: `${i * 55}ms` }}>
                <ParcelCard p={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card grid-paper px-6 py-16 text-center">
            <h3 className="display text-lg">Nothing saved yet</h3>
            <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
              Save parcels from the discovery map to compare them here.
            </p>
          </div>
        )}

        <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-faint">
          Saving is not stored to your account yet — these stand in for the parcels you would have
          bookmarked while browsing.
        </p>
      </section>

      {/* ── Leases ───────────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Executed agreements"
          title="Your leases"
          description="Registration status is shown exactly as recorded — a stamped lease is not a registered one."
          aside={
            myLeases.length > 0 ? (
              <p className="readout text-xs text-ink-faint">
                {activeLeases.length} active of {myLeases.length}
              </p>
            ) : undefined
          }
        />

        <div className="card overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Ref
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Parcel
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    Lessor
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
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {myLeases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm text-ink-muted">
                      No leases executed yet.
                    </td>
                  </tr>
                ) : (
                  myLeases.map((l) => (
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
                        <span className="readout ml-2 text-xs text-ink-faint">
                          {formatAcres(l.areaAcres)} ac
                        </span>
                      </td>
                      <td className="px-5 py-4 text-ink-muted">{l.lessorName}</td>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-faint">{NO_TENANCY}</p>
      </section>

      {/* ── Payments ─────────────────────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-20">
        <SectionHead
          eyebrow="Rent schedule"
          title="Payments"
          description="Your upcoming rent instalments."
          aside={
            myPayments.length > 0 ? (
              <p className="readout text-xs text-ink-faint">
                {myPayments.length} scheduled
              </p>
            ) : undefined
          }
        />

        {myPayments.length === 0 ? (
          <p className="card px-6 py-14 text-center text-sm text-ink-muted">
            No instalments scheduled.
          </p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {myPayments.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {l.village}
                    <span className="readout ml-2 font-normal text-ink-faint">
                      {formatAcres(l.areaAcres)} ac
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    To {l.lessorName} · <span className="readout">{l.ref}</span>
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
