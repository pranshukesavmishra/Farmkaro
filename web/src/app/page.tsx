import Link from "next/link";
import {
  ArrowRight,
  FileSignature,
  IndianRupee,
  Map as MapIcon,
  Search,
  ShieldCheck,
} from "lucide-react";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { ParcelCard } from "@/components/parcel-card";
import { getRepository } from "@/lib/repo";
import { JABALPUR } from "@/lib/seed";
import { formatAcres, formatINR } from "@/lib/geo";

const WHY = [
  {
    icon: ShieldCheck,
    title: "An honest verification ladder",
    body: "Every parcel shows the exact rung it has reached. “Uploaded” is not “verified”, and we never blur the two.",
  },
  {
    icon: MapIcon,
    title: "Real land, on real satellite",
    body: "Parcels sit at their true coordinates on live imagery. A surveyed boundary is drawn only once one genuinely exists.",
  },
  {
    icon: FileSignature,
    title: "Leases with an end date",
    body: "Executed under the state framework: a fixed term, possession reverting on expiry, and no tenancy or occupancy rights created.",
  },
  {
    icon: IndianRupee,
    title: "Published, transparent pricing",
    body: "A public fee list, and rent ranges drawn only from leases that actually completed. No invented valuations.",
  },
];

const STEPS = [
  { n: "01", t: "Discover", d: "Search by village or radius. Compare rent, water, road access and soil on one map." },
  { n: "02", t: "Verify", d: "Inspect documents, boundary status and the owner's identity checks before you commit." },
  { n: "03", t: "Lease", d: "Agree terms, sign digitally, and register the lease under the state framework." },
  { n: "04", t: "Farm", d: "Rent schedule, receipts and renewal reminders run in one place for both sides." },
];

export default async function Home() {
  const repo = getRepository();
  const [hero] = await repo.search({ limit: 1, sort: "area_desc" });
  const featured = await repo.search({
    lng: JABALPUR[0],
    lat: JABALPUR[1],
    radiusKm: 50,
    limit: 6,
    sort: "match",
  });

  // Real totals across everything listed — never a multiplied-up figure.
  const all = await repo.search({});
  const totalAcres = all.reduce((sum, p) => sum + p.areaAcres, 0);
  const villages = new Set(all.map((p) => p.village)).size;

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {hero && (
            <ParcelOverlayCard
              geometry={hero.geometry}
              pad={3.4}
              rounded="rounded-none"
              className="h-full w-full"
            />
          )}
        </div>
        {/* Scrim: keeps type legible while letting the land show through. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(105deg, var(--canvas) 0%, color-mix(in srgb, var(--canvas) 88%, transparent) 34%, color-mix(in srgb, var(--canvas) 30%, transparent) 62%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, var(--canvas))" }}
        />

        <div className="mx-auto max-w-shell px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <p className="eyebrow rise-hero">Madhya Pradesh · Jabalpur district</p>

          <h1 className="display mt-5 max-w-[15ch] text-3xl">
            <span className="block rise-hero" style={{ animationDelay: "120ms" }}>
              Find the right farmland.
            </span>
            <span className="block text-brand rise-hero" style={{ animationDelay: "280ms" }}>
              Lease it with confidence.
            </span>
          </h1>

          <p
            className="mt-6 max-w-[46ch] text-md leading-relaxed text-ink-muted rise-hero"
            style={{ animationDelay: "440ms" }}
          >
            Registered, non-tenancy-creating leases on farmland you can actually inspect — real
            locations, honest document status, and an end date both sides can rely on.
          </p>
          <p
            className="mt-2 max-w-[46ch] text-sm text-ink-faint rise-hero"
            style={{ animationDelay: "540ms" }}
          >
            कागज़ पूरे, तारीख़ तय, ज़मीन आपकी।
          </p>

          {/* Search — an instrument, not a form */}
          <form
            action="/discover"
            className="card ticks mt-9 flex max-w-xl flex-col gap-2 p-2 shadow-lg rise-hero sm:flex-row sm:items-center"
            style={{ animationDelay: "640ms" }}
          >
            <label htmlFor="q" className="sr-only">
              Village or tehsil
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <input
                id="q"
                name="q"
                placeholder="Village or tehsil in Jabalpur"
                className="field border-0 bg-transparent pl-9 focus:shadow-none"
              />
            </div>
            <label htmlFor="radiusKm" className="sr-only">
              Radius
            </label>
            <select
              id="radiusKm"
              name="radiusKm"
              defaultValue="20"
              className="field w-full border-0 bg-surface-2 font-mono text-sm sm:w-auto"
            >
              {[5, 10, 20, 50].map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary px-6 py-3">
              Search farmland
            </button>
          </form>

          {/* Live readout strip */}
          <dl
            className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-5 rise-hero"
            style={{ animationDelay: "780ms" }}
          >
            {[
              { k: "Parcels listed", v: String(all.length) },
              { k: "Villages covered", v: String(villages) },
              { k: "Acres on the map", v: formatAcres(totalAcres) },
            ].map((s) => (
              <div key={s.k}>
                <dd className="readout text-xl font-semibold text-ink">{s.v}</dd>
                <dt className="eyebrow mt-1">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Featured parcels ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Available now</p>
            <h2 className="display mt-2 text-xl">Farmland near Jabalpur</h2>
            <p className="mt-2 max-w-prose text-sm text-ink-muted">
              Each card shows the parcel at its true location on satellite imagery, with the rent,
              water source and verification status stated up front.
            </p>
          </div>
          <Link href="/discover" className="btn btn-ghost">
            Open the map <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <div key={p.id} className="rise" style={{ animationDelay: `${i * 55}ms` }}>
              <ParcelCard p={p} />
            </div>
          ))}
        </div>
        <SatelliteAttribution className="mt-6" />
      </section>

      {/* ── Why ─────────────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface-2">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 sm:py-20">
          <p className="eyebrow">Why lease through FarmKaro</p>
          <h2 className="display mt-2 max-w-[20ch] text-xl">
            The paperwork is the product.
          </h2>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {WHY.map((w) => (
              <div key={w.title} className="bg-surface p-6 sm:p-7">
                <w.icon className="h-5 w-5 text-brand" aria-hidden />
                <h3 className="mt-4 text-md font-semibold">{w.title}</h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6 sm:py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="display mt-2 text-xl">Discover → Verify → Lease → Farm</h2>

        <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="border-t border-line pt-5">
              <span className="readout text-sm font-semibold text-brand">{s.n}</span>
              <h3 className="display mt-2 text-lg">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="card ticks mt-14 flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h3 className="display text-lg">Own farmland lying idle?</h3>
            <p className="mt-2 max-w-prose text-sm text-ink-muted">
              Listing is free for landowners, always. Upload your khasra copy and we read the
              details straight off it.
            </p>
          </div>
          <Link href="/list-land" className="btn btn-primary shrink-0 px-6 py-3">
            List your land <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-shell px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="display text-md">FarmKaro</p>
              <p className="mt-1 text-sm text-ink-muted">
                Making it safe to lease out farmland — and leased-in land bankable.
              </p>
            </div>
            <p className="max-w-prose text-xs leading-relaxed text-ink-faint">
              A FarmKaro review confirms documents were submitted and inspected by our team. It is
              not a government verification of title and does not certify ownership.
            </p>
          </div>
          <p className="mt-8 border-t border-line pt-5 font-mono text-xs text-ink-faint">
            © {new Date().getFullYear()} FarmKaro · Jabalpur, Madhya Pradesh
          </p>
        </div>
      </footer>
    </>
  );
}
