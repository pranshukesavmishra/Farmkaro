import type { Metadata } from "next";
import Link from "next/link";
import { ParcelOverlayCard } from "@/components/parcel-overlay-card";
import { Badge, Section, StatTile } from "@/components/ui";
import { getRepository } from "@/lib/repo";
import { formatAcres, formatINR } from "@/lib/geo";
import { GEOMETRY_LABEL, REGISTRATION_LABEL, type Lease } from "@/lib/types";

export const metadata: Metadata = { title: "Landowner dashboard" };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const NO_TENANCY =
  "Leases executed under the state land-leasing framework do not create tenancy or occupancy rights; possession reverts on expiry.";

function registrationTone(s: Lease["registrationStatus"]) {
  switch (s) {
    case "registered":
      return "good" as const;
    case "submitted_for_registration":
      return "pending" as const;
    case "stamped":
      return "neutral" as const;
    default:
      return "muted" as const;
  }
}

function leaseStatusTone(s: Lease["status"]) {
  switch (s) {
    case "active":
      return "good" as const;
    case "expiring":
      return "pending" as const;
    case "signed":
      return "neutral" as const;
    default:
      return "muted" as const;
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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
          Landowner dashboard
        </h1>
        <p className="mt-1.5 text-[14.5px] muted">
          Your parcels, leases and verification, in one place.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total parcels" value={String(parcels.length)} />
        <StatTile label="Active listings" value={String(activeListings)} tone="accent" />
        <StatTile label="Executed leases" value={String(leases.length)} />
        <StatTile
          label="Rent under lease"
          value={formatINR(rentUnderLease, { compact: true })}
          sub="per year, active leases"
        />
        <StatTile
          label="Expiring soon"
          value={String(expiringSoon)}
          tone={expiringSoon > 0 ? "warn" : "default"}
        />
      </div>

      <Section
        title="Your parcels"
        description="Each parcel shows the exact verification rung it has reached — nothing is marked verified until it is."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {parcels.map((p) => {
            const reviewed = p.documents.filter((d) => d.status === "reviewed_by_farmkaro").length;
            return (
              <div key={p.id} className="surface overflow-hidden rounded-2xl border">
                <div className="h-44">
                  <ParcelOverlayCard
                    geometry={p.geometry}
                    href={`/parcel/${p.id}`}
                    rounded="rounded-none"
                    pills={[
                      {
                        label: "Area",
                        value: `${formatAcres(p.areaAcres)} ac`,
                        at: { x: 0.2, y: 0.16 },
                      },
                      {
                        label: "Rent",
                        value: `${formatINR(p.listing.rentAnnual, { compact: true })}/yr`,
                        at: { x: 0.7, y: 0.16 },
                      },
                    ]}
                  />
                </div>
                <div className="space-y-2.5 p-4">
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight">{p.village}</h3>
                    <p className="mt-0.5 font-mono text-[11.5px] muted">
                      {p.ref} · Khasra {p.khasraNumber}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        p.geometryStatus === "boundary_walked_by_farmkaro" ||
                        p.geometryStatus === "matched_to_cadastral_record"
                          ? "good"
                          : "neutral"
                      }
                    >
                      {GEOMETRY_LABEL[p.geometryStatus]}
                    </Badge>
                    {p.listing.status !== "active" && (
                      <Badge tone="muted" className="capitalize">
                        {p.listing.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[12.5px] muted">
                    Documents: {reviewed} of {p.documents.length} reviewed
                  </p>
                  <Link
                    href={`/parcel/${p.id}`}
                    className="focus-ring inline-block rounded text-[13px] font-semibold text-forest-700 hover:underline dark:text-forest-300"
                  >
                    Open parcel →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Leases" description="Registration status is shown exactly as recorded — a stamped lease is not a registered one.">
        <div className="surface overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[820px] text-left text-[13.5px]">
            <thead>
              <tr className="hairline border-b text-[11px] uppercase tracking-[0.08em] muted">
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Parcel</th>
                <th className="px-4 py-3 font-medium">Lessee</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Rent/yr</th>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {leases.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-mono text-[12.5px] tabular-nums">{l.ref}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/parcel/${l.parcelId}`}
                      className="focus-ring rounded font-medium hover:underline"
                    >
                      {l.village}
                    </Link>
                    <span className="ml-1.5 font-mono text-[11.5px] muted">{l.parcelRef}</span>
                  </td>
                  <td className="px-4 py-3">{l.lesseeName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px] tabular-nums">
                    {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] tabular-nums">
                    {formatINR(l.rentAnnual)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={registrationTone(l.registrationStatus)}>
                      {REGISTRATION_LABEL[l.registrationStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={leaseStatusTone(l.status)} className="capitalize">
                      {l.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.55] muted">{NO_TENANCY}</p>
      </Section>

      <Section title="Next payments" description="Upcoming rent instalments across your leases.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nextPayments.map((l) => (
            <li key={l.id} className="surface rounded-xl border p-4">
              <p className="text-[14px] font-semibold tracking-tight">{l.lesseeName}</p>
              <p className="mt-0.5 text-[12.5px] muted">
                {l.village} · {l.ref}
              </p>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="font-mono text-[12.5px] tabular-nums muted">
                  Due {fmtDate(l.nextPaymentDue!)}
                </span>
                <span className="font-mono text-[16px] font-semibold tabular-nums">
                  {formatINR(l.nextPaymentAmount ?? 0)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
