import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ParcelOverlayCard } from "@/components/parcel-overlay-card";
import { ParcelCard } from "@/components/parcel-card";
import { MatchScore } from "@/components/match-score";
import { Badge, EmptyState, Section } from "@/components/ui";
import { getRepository } from "@/lib/repo";
import { JABALPUR } from "@/lib/seed";
import { formatAcres, formatINR } from "@/lib/geo";
import { REGISTRATION_LABEL, WATER_LABEL, type Lease } from "@/lib/types";

export const metadata: Metadata = { title: "Cultivator dashboard" };

const MY_NAMES = ["Ajay Patel", "Rakesh Kushwaha"];

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
  const myPayments = myLeases.filter((l) => l.nextPaymentDue);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
          Cultivator dashboard
        </h1>
        <p className="mt-1.5 text-[14.5px] muted">
          Land matched to your preferences, your leases and your payment schedule.
        </p>
      </div>

      <Section
        title="Recommended for you"
        description="Scores are computed from your stated preferences — every component is a plain rule you can inspect."
        action={
          <Badge tone="gold">
            <Sparkles className="h-3 w-3" aria-hidden />
            Explainable matches
          </Badge>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px] muted">
          <span>Your preferences:</span>
          <Badge tone="neutral">Wheat</Badge>
          <Badge tone="neutral">≤ ₹20,000/acre</Badge>
          <Badge tone="neutral">25 km of Jabalpur</Badge>
        </div>

        {top ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="h-64">
                <ParcelOverlayCard
                  geometry={top.geometry}
                  href={`/parcel/${top.id}`}
                  placeLabel={`${top.village}, ${top.tehsil}`}
                  pills={[
                    {
                      label: "Area",
                      value: `${formatAcres(top.areaAcres)} ac`,
                      at: { x: 0.16, y: 0.16 },
                    },
                    {
                      label: "Water",
                      value: WATER_LABEL[top.waterSources[0]],
                      at: { x: 0.83, y: 0.18 },
                    },
                    {
                      label: "Rent",
                      value: `${formatINR(top.listing.rentPerAcre)}/ac`,
                      at: { x: 0.17, y: 0.8 },
                      tone: "accent",
                    },
                  ]}
                />
              </div>
              <p className="mt-2.5 text-[14px]">
                <Link
                  href={`/parcel/${top.id}`}
                  className="focus-ring rounded font-semibold hover:underline"
                >
                  {formatAcres(top.areaAcres)} acres in {top.village}
                </Link>{" "}
                <span className="muted">
                  · {formatINR(top.listing.rentAnnual)}/yr ·{" "}
                  <span className="font-mono text-[12.5px]">{top.ref}</span>
                </span>
              </p>
            </div>
            {top.match && (
              <MatchScore score={top.match.score} breakdown={top.match.breakdown} className="self-start" />
            )}
          </div>
        ) : (
          <EmptyState
            title="No recommendations yet"
            body="No parcels match your preferences right now — widen the radius or relax a filter in Discover."
          />
        )}

        {restRecommended.length > 0 && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {restRecommended.map((p) => (
              <ParcelCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Saved parcels" description="Parcels you bookmarked while exploring.">
        {saved.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((p) => (
              <ParcelCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing saved yet"
            body="Save parcels from the discovery map to compare them here."
          />
        )}
      </Section>

      <Section
        title="Your leases"
        description="Registration status is shown exactly as recorded — a stamped lease is not a registered one."
      >
        <div className="surface overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead>
              <tr className="hairline border-b text-[11px] uppercase tracking-[0.08em] muted">
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Parcel</th>
                <th className="px-4 py-3 font-medium">Lessor</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Rent/yr</th>
                <th className="px-4 py-3 font-medium">Registration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {myLeases.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-mono text-[12.5px] tabular-nums">{l.ref}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/parcel/${l.parcelId}`}
                      className="focus-ring rounded font-medium hover:underline"
                    >
                      {l.village}
                    </Link>
                    <span className="ml-1.5 font-mono text-[11.5px] muted">
                      {formatAcres(l.areaAcres)} ac
                    </span>
                  </td>
                  <td className="px-4 py-3">{l.lessorName}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.55] muted">{NO_TENANCY}</p>
      </Section>

      <Section title="Payments" description="Your upcoming rent instalments.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {myPayments.map((l) => (
            <li key={l.id} className="surface rounded-xl border p-4">
              <p className="text-[14px] font-semibold tracking-tight">
                {l.village} · {formatAcres(l.areaAcres)} ac
              </p>
              <p className="mt-0.5 text-[12.5px] muted">
                To {l.lessorName} · {l.ref}
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
