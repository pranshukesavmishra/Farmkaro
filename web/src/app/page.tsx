import Link from "next/link";
import {
  FileSignature,
  IndianRupee,
  Map as MapIcon,
  Search,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { ParcelCard } from "@/components/parcel-card";
import { Section } from "@/components/ui";
import { getRepository } from "@/lib/repo";
import { JABALPUR } from "@/lib/seed";
import { formatAcres, formatINR } from "@/lib/geo";
import { WATER_LABEL } from "@/lib/types";

const WHY = [
  {
    icon: ShieldCheck,
    title: "Honest verification ladder",
    body: "Every parcel shows the exact rung reached — uploaded is not the same as verified, and we never pretend otherwise.",
  },
  {
    icon: FileSignature,
    title: "Registered digital leases",
    body: "Fixed end dates with certainty of possession. Leases under the state framework create no tenancy or occupancy rights.",
  },
  {
    icon: MapIcon,
    title: "Real parcel boundaries",
    body: "Actual polygons on satellite imagery — GeoJSON you can inspect, never a pin dropped somewhere near the land.",
  },
  {
    icon: IndianRupee,
    title: "Transparent pricing",
    body: "A published fee list and rent comparables from completed leases. No hidden brokerage, no invented estimates.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Discover",
    body: "Search real parcels around Jabalpur by water, area, rent and crop — with explainable match scores.",
  },
  {
    n: "02",
    title: "Verify",
    body: "Read the verification ladder for boundaries, documents and identity before you commit to anything.",
  },
  {
    n: "03",
    title: "Lease",
    body: "Execute a digital lease with a fixed term and registration status you can see at every step.",
  },
  {
    n: "04",
    title: "Farm",
    body: "Cultivate with certainty — rent schedules are recorded, and possession reverts on expiry.",
  },
];

export default async function HomePage() {
  const repo = getRepository();
  const [heroParcels, nearby] = await Promise.all([
    repo.search({ sort: "area_desc", limit: 1 }),
    repo.search({ lng: JABALPUR[0], lat: JABALPUR[1], radiusKm: 50, limit: 6 }),
  ]);
  const hero = heroParcels[0];

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div className="max-w-[560px]">
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[46px]">
            Find the right farmland. Lease it with confidence.
          </h1>
          <p className="mt-4 text-[15.5px] leading-[1.6] muted sm:text-[16.5px]">
            Registered, non-tenancy-creating leases on verified parcels in the Jabalpur pilot
            district — real boundaries, honest document status, and end-date certainty for both
            sides.
          </p>
          <p className="mt-3 text-[15px] font-medium text-forest-700 dark:text-forest-300">
            कागज़ पूरे, तारीख तय, ज़मीन आपकी।
          </p>

          <form
            action="/discover"
            method="get"
            className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-stretch"
          >
            <label className="surface flex flex-1 items-center gap-2.5 rounded-xl border px-3.5">
              <Search className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden />
              <input
                type="text"
                name="q"
                placeholder="Village or tehsil in Jabalpur…"
                className="focus-ring w-full bg-transparent py-3 text-[14.5px] outline-none placeholder:text-[var(--fg-muted)]"
                aria-label="Village or tehsil in Jabalpur"
              />
            </label>
            <select
              name="radiusKm"
              defaultValue="20"
              aria-label="Search radius"
              className="surface focus-ring rounded-xl border px-3.5 py-3 text-[14px]"
            >
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="20">Within 20 km</option>
              <option value="50">Within 50 km</option>
            </select>
            <button
              type="submit"
              className="focus-ring rounded-xl bg-forest-900 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-forest-700 dark:bg-forest-500 dark:hover:bg-forest-300 dark:hover:text-forest-950"
            >
              Search farmland
            </button>
          </form>
        </div>

        {hero && (
          <div>
            <div className="h-[340px] sm:h-[420px] lg:h-[460px]">
              <ParcelOverlayCard
                geometry={hero.geometry}
                href={`/parcel/${hero.id}`}
                placeLabel={`${hero.village}, ${hero.tehsil}`}
                priorityLabel="Jabalpur pilot"
                pills={[
                  {
                    label: "Area",
                    value: `${formatAcres(hero.areaAcres)} ac`,
                    at: { x: 0.18, y: 0.14 },
                  },
                  {
                    label: "Water",
                    value: WATER_LABEL[hero.waterSources[0]],
                    at: { x: 0.8, y: 0.2 },
                  },
                  {
                    label: "Rent",
                    value: `${formatINR(hero.listing.rentAnnual, { compact: true })}/yr`,
                    at: { x: 0.76, y: 0.74 },
                    tone: "accent",
                  },
                ]}
              />
            </div>
            <SatelliteAttribution className="mt-2" />
          </div>
        )}
      </section>

      {/* Nearby parcels */}
      <Section
        title="Explore farmland near Jabalpur"
        description="Active listings within 50 km of the district centre, drawn with their real boundaries."
        action={
          <Link
            href="/discover"
            className="focus-ring rounded-md text-[13.5px] font-semibold text-forest-700 hover:underline dark:text-forest-300"
          >
            View all on the map →
          </Link>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((p) => (
            <ParcelCard key={p.id} p={p} showMatch={false} />
          ))}
        </div>
      </Section>

      {/* Why FarmKaro */}
      <Section
        title="Why lease through FarmKaro"
        description="Leasing land in India runs on trust. We make the trust inspectable."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.title} className="surface rounded-2xl border p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-forest-500/12 text-forest-700 dark:text-forest-300">
                <w.icon className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight">{w.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-[1.55] muted">{w.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section
        title="How it works"
        description="From first search to first sowing, every step leaves a paper trail."
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="surface rounded-2xl border p-5">
              <span className="font-mono text-[12px] font-semibold tabular-nums text-forest-500">
                {s.n}
              </span>
              <h3 className="mt-2 text-[16px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-[1.55] muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Footer */}
      <footer className="hairline mt-6 border-t py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-forest-900 text-forest-100">
              <Sprout className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-[13.5px] font-semibold">FarmKaro</span>
            <span className="text-[13px] muted">· Jabalpur, Madhya Pradesh</span>
          </div>
          <div className="max-w-[52ch] space-y-1.5">
            <SatelliteAttribution />
            <p className="text-[10.5px] muted">
              A FarmKaro review is not a government verification of title.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
