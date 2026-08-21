"use client";

/**
 * अपनी ज़मीन खोजें — Find my land.
 *
 * The owner-facing face of the consent-gated land-records connector: name
 * your own khasra (with its village) or your own Land ID, and the record
 * comes back in full — owners and shares, area in three units, soil, crops,
 * चौहद्दी, encumbrance, mutation — pinned on satellite imagery at the
 * village's real position.
 *
 * Two lines this page never crosses, by design: no search by anyone's name,
 * and no invented parcel boundary. The pin is village-precision and says so;
 * the exact boundary appears only after Bhu-Naksha verification.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Printer,
  Compass,
  FileSearch,
  Landmark,
  Loader2,
  MapPin,
  ScrollText,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { KhasraScan } from "./khasra-scan";
import { IS_STATIC } from "@/lib/flags";
import {
  DISTRICT_STATS,
  FARMER_SCHEMES,
  REGISTRY_VILLAGES,
  STATE_PORTALS,
  TEHSILS,
  findVillage,
} from "@/lib/district";
import { DemoArchivePanel } from "./demo-archive-panel";
import { LAND_RECORD_CONSENT_STATEMENT } from "@/lib/consent";
import type { PolygonCoords, Position } from "@/lib/geo";
import { cn } from "@/lib/cn";

/* ---------- API shapes (mirrors LandParcelRecord) -------------------------- */

interface RecordDto {
  khasraNumber?: string;
  village?: string;
  areaAcres?: number;
  khataNumber?: string;
  location?: { center: Position; precision: string; label: string };
  record?: {
    landId: string;
    halka: string;
    tehsil: string;
    tehsilHi: string;
    villageHi: string;
    areaHectares: number;
    areaBigha: number;
    landUse: string;
    soil: string;
    soilHi: string;
    irrigation: string;
    revenuePerYear: number;
    owners: Array<{
      name: string;
      nameHi: string;
      relation: string;
      sharePercent: number;
      aadhaarVerified: boolean;
    }>;
    crops: Array<{ season: string; crop: string; areaHectares: number; irrigated: boolean }>;
    boundaries: { north: string; south: string; east: string; west: string };
    encumbrance: { status: string; detail: string };
    mutation: { orderNo: string; date: string; note: string };
  };
}

interface LookupResponse {
  found: boolean;
  isAuthoritative: boolean;
  parcels: RecordDto[];
  note: string | null;
  error?: string;
}

/** ~150 m ring around the centroid: enough for the camera; never drawn. */
function ringAround([lng, lat]: Position): PolygonCoords {
  const d = 0.0014;
  return [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]];
}

const SEASON_LABEL: Record<string, string> = {
  rabi: "रबी · Rabi",
  kharif: "ख़रीफ़ · Kharif",
  annual: "वार्षिक · Annual",
};

export function RecordsClient() {
  const { user, ready, openLogin } = useAuth();
  const [kind, setKind] = useState<"khasra" | "landid">("khasra");
  const [village, setVillage] = useState("");
  const [khasra, setKhasra] = useState("");
  const [landId, setLandId] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);

  const villagesByTehsil = useMemo(
    () =>
      TEHSILS.map((t) => ({
        tehsil: t,
        villages: REGISTRY_VILLAGES.filter((v) => v.tehsilCode === t.code),
      })).filter((g) => g.villages.length > 0),
    [],
  );

  const canSearch =
    consent && (kind === "khasra" ? village !== "" && khasra.trim() !== "" : landId.trim() !== "");

  async function search() {
    if (!user) {
      openLogin();
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/land-records/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: "Madhya Pradesh",
          district: "Jabalpur",
          village: kind === "khasra" ? village : undefined,
          khasraNumber: kind === "khasra" ? khasra.trim() : undefined,
          bhuswamiId: kind === "landid" ? landId.trim() : undefined,
          consentGiven: true,
        }),
      });
      const data = (await res.json()) as LookupResponse;
      if (!res.ok) throw new Error(data.error ?? "The lookup failed.");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (IS_STATIC) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="display text-2xl">Find my land</h1>
        <p className="mx-auto mt-4 max-w-prose text-md leading-relaxed text-ink-muted">
          Record lookup runs in the pilot app — this public demo is read-only.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <header className="max-w-2xl rise">
        <p className="eyebrow">भू-अभिलेख खोज · Jabalpur pilot</p>
        <h1 className="display mt-2.5 text-2xl">Find my land</h1>
        <p className="mt-4 max-w-prose text-md leading-relaxed text-ink-muted">
          Enter your own khasra number with its village — or your Land ID — and see the record with
          its position on the map. Many owners only have the paper copy;{" "}
          <span className="text-ink">uploading a khasra copy works too.</span>
        </p>
        <p className="mt-3 flex max-w-prose gap-2 text-sm leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span>
            Lookups are for your own land only, with your recorded consent — there is deliberately
            no search by name here.
          </span>
        </p>
      </header>

      {/* District context — approximate public figures, labelled as such. */}
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5 rise" style={{ animationDelay: "60ms" }}>
        {DISTRICT_STATS.map((st) => (
          <div key={st.label} className="bg-surface-2 px-4 py-3.5">
            <dt className="eyebrow">{st.labelHi}</dt>
            <dd className="readout mt-1.5 text-md font-semibold">{st.value}</dd>
          </div>
        ))}
        <p className="col-span-2 bg-surface-2 px-4 py-3.5 text-xs leading-relaxed text-ink-muted sm:col-span-5 sm:border-t sm:border-line">
          Approximate public administrative figures for Jabalpur district — the authority on all of
          them is the revenue department at mpbhulekh.gov.in.
        </p>
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ── Search rail ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="card ticks p-5 sm:p-6">
            <div className="flex gap-1 rounded-full border border-line p-1" role="tablist">
              {(
                [
                  ["khasra", "Khasra + village"],
                  ["landid", "Land ID"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "focus-ring flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                    kind === k ? "bg-brand text-brand-ink" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              {kind === "khasra" ? (
                <>
                  <div>
                    <label htmlFor="rec-village" className="eyebrow mb-2 block">
                      ग्राम · Village
                    </label>
                    <select
                      id="rec-village"
                      className="field"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                    >
                      <option value="">Select village…</option>
                      {villagesByTehsil.map((g) => (
                        <optgroup key={g.tehsil.code} label={`${g.tehsil.nameHi} · ${g.tehsil.name} tehsil`}>
                          {g.villages.map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.nameHi} · {v.name} (हल्का {v.halka})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rec-khasra" className="eyebrow mb-2 block">
                      खसरा क्रमांक · Khasra number
                    </label>
                    <input
                      id="rec-khasra"
                      className="field readout placeholder:font-sans placeholder:tracking-normal"
                      placeholder="e.g. 104/1"
                      value={khasra}
                      onChange={(e) => setKhasra(e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-ink-muted">
                      Devanagari digits work too — १०४/१ finds 104/1.
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="rec-landid" className="eyebrow mb-2 block">
                    Land ID
                  </label>
                  <input
                    id="rec-landid"
                    className="field readout placeholder:font-sans placeholder:tracking-normal"
                    placeholder="e.g. MP-JBL-PAN-10401"
                    value={landId}
                    onChange={(e) => setLandId(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-ink-muted">
                    The full land id printed on your khasra copy. A khata number alone is not
                    enough — khata serials repeat across villages, so use the khasra tab for those.
                  </p>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line bg-surface-2 p-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--brand)]"
                />
                <span className="text-ink-muted">{LAND_RECORD_CONSENT_STATEMENT}</span>
              </label>

              <button type="submit" disabled={busy || !canSearch} className="btn btn-primary w-full py-3">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileSearch className="h-4 w-4" aria-hidden />
                )}
                Find the record
              </button>
              {!user && ready && (
                <p className="text-center text-xs text-ink-faint">You&rsquo;ll be asked to sign in first.</p>
              )}
            </form>
          </div>

          <KhasraScan
            onExtract={(x) => {
              if (x.khasraNumber) {
                setKind("khasra");
                setKhasra(x.khasraNumber);
              }
              if (x.village) {
                const match = findVillage(x.village);
                if (match) setVillage(match.name);
              }
            }}
          />
        </div>

        {/* ── Result ──────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {error && (
            <p
              role="alert"
              className="rounded-[10px] border px-4 py-3 text-sm leading-relaxed text-danger"
              style={{
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                borderColor: "color-mix(in srgb, var(--danger) 28%, transparent)",
              }}
            >
              {error}
            </p>
          )}

          {!result && !error && (
            <div className="card grid-paper flex min-h-[24rem] flex-col items-center justify-center px-6 py-16 text-center">
              <MapPin className="h-8 w-8 text-ink-faint" aria-hidden />
              <p className="display mt-4 text-lg">Your record appears here</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
                With its owners, area, crops, चौहद्दी and encumbrance status — and its village
                pinned on satellite imagery.
              </p>
            </div>
          )}

          {result && !result.found && (
            <div className="card px-6 py-12 text-center">
              <p className="display text-lg">No record found</p>
              <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
                {result.note ?? "Check the village and number against your khasra copy."}
              </p>
            </div>
          )}

          {result?.found &&
            result.parcels.map((p, i) => (
              <RecordCard key={p.record?.landId ?? `${p.khasraNumber ?? "row"}-${i}`} p={p} note={result.note} />
            ))}
        </div>
      </div>

      {/* ── Schemes footer ───────────────────────────────────────────────── */}
      <section className="mt-20 border-t border-line pt-12">
        <p className="eyebrow">कृषक कल्याण · For landholders</p>
        <h2 className="display mt-2 text-xl">Schemes worth checking</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          Each has its own eligibility conditions beyond holding a khasra — the linked official
          portal is the authority on whether you qualify.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FARMER_SCHEMES.map((s) => (
            <a
              key={s.name}
              href={s.portal}
              target="_blank"
              rel="noopener noreferrer"
              className="card card-lift focus-ring group flex flex-col p-5"
            >
              <Landmark className="h-4 w-4 text-brand" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold leading-snug">{s.name}</h3>
              <p className="mt-0.5 text-xs text-ink-faint">{s.nameHi}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{s.benefit}</p>
              <p className="readout mt-auto pt-4 text-xs text-brand">
                {s.portalLabel} <ArrowRight className="inline h-3 w-3" aria-hidden />
              </p>
            </a>
          ))}
        </div>
      </section>

      <DemoArchivePanel />

      {/* Pan-India official portals */}
      <section className="mt-20 border-t border-line pt-12">
        <p className="eyebrow">अखिल भारतीय · Other states</p>
        <h2 className="display mt-2 text-xl">Official Bhulekh portals, state by state</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          Only portals we are confident are the real government gateways are listed — a state
          missing here has not been verified yet, which beats publishing a guessed link as
          official.
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STATE_PORTALS.map((sp) => (
            <li key={sp.state}>
              <a
                href={sp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-baseline justify-between gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="font-medium">{sp.state}</span>
                  <span className="ml-1.5 text-xs text-ink-faint">{sp.stateHi}</span>
                </span>
                <span className="readout shrink-0 text-xs text-brand">{sp.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- the record itself ---------------------------------------------- */

function RecordCard({ p, note }: { p: RecordDto; note: string | null }) {
  const r = p.record;
  if (!r) {
    // A live state integration returns leaner rows than the pilot set: show
    // what it sent rather than nothing.
    return (
      <article className="card rise p-5 sm:p-7">
        <h2 className="display text-xl">
          {p.village ?? "Record"} {p.khasraNumber && <>— खसरा <span className="readout">{p.khasraNumber}</span></>}
        </h2>
        <dl className="mt-4 divide-y divide-line text-sm">
          {p.khataNumber && (
            <div className="flex justify-between py-2.5"><dt className="eyebrow">खाता</dt><dd className="readout">{p.khataNumber}</dd></div>
          )}
          {p.areaAcres != null && (
            <div className="flex justify-between py-2.5"><dt className="eyebrow">Area</dt><dd className="readout">{p.areaAcres.toFixed(2)} ac</dd></div>
          )}
        </dl>
        {note && <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-ink-muted">{note}</p>}
      </article>
    );
  }
  const enc = r.encumbrance;
  const encTone =
    enc.status === "clean" ? "positive" : enc.status === "mortgaged" ? "warn" : "info";

  return (
    <article className="print-area card overflow-hidden rise">
      {/* Print-only banner: a FarmKaro summary is a reference, never a
          certified extract — and it says so on the paper itself. */}
      <p className="print-banner hidden">
        FarmKaro record summary — REFERENCE ONLY. This is not a government-certified extract and
        carries no official seal. Certified khasra/khatauni copies: mpbhulekh.gov.in
      </p>
      {/* Map: the village's real position; boundary honestly absent. */}
      {p.location && (
        <div className="relative h-[240px] sm:h-[300px]">
          <ParcelOverlayCard
            geometry={ringAround(p.location.center)}
            placeLabel={`${r.villageHi} · ${p.village}`}
            rounded="rounded-none"
            pad={2.2}
            className="h-full w-full"
          />
          <div className="pointer-events-none absolute inset-x-4 bottom-3 flex justify-start">
            <span className="glass rounded-full px-3 py-1.5 text-[11px] font-medium leading-tight text-white/90">
              Village-level position · exact boundary after Bhu-Naksha verification
            </span>
          </div>
        </div>
      )}

      <div className="space-y-8 p-5 sm:p-7">
        {/* Identity */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {r.tehsilHi} तहसील · हल्का {r.halka}
            </p>
            <h2 className="display mt-2 text-xl">
              {r.villageHi} — खसरा <span className="readout">{p.khasraNumber}</span>
            </h2>
            <p className="readout mt-2 text-sm text-ink-muted">
              {r.landId} · खाता {p.khataNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className="btn btn-ghost">
              <Printer className="h-4 w-4" aria-hidden /> Print summary
            </button>
            <Link href="/list-land" className="btn btn-primary">
              List this land <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* Area in the three units everyone actually uses */}
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {(
            [
              ["हेक्टेयर", r.areaHectares.toFixed(3)],
              ["एकड़ · Acre", (p.areaAcres ?? 0).toFixed(2)],
              ["बीघा", r.areaBigha.toFixed(2)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-surface-2 px-4 py-4">
              <dt className="eyebrow">{label}</dt>
              <dd className="readout mt-2 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Owners */}
        <section>
          <h3 className="eyebrow border-b border-line pb-2">भू-स्वामी · Recorded owners</h3>
          <ul className="divide-y divide-line">
            {r.owners.map((o, i) => (
              <li key={`${i}-${o.name}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                <div>
                  <p className="font-semibold">{o.nameHi}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {o.name} · {o.relation}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {o.aadhaarVerified && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-ink-muted"
                      title="The source record marks this owner Aadhaar-verified. FarmKaro has not performed this verification."
                    >
                      <BadgeCheck className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                      Aadhaar-verified <span className="text-ink-faint">(as per record)</span>
                    </span>
                  )}
                  <span className="readout text-sm font-semibold">{o.sharePercent}%</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Encumbrance — the thing a lessee most needs to know */}
        <section
          className="rounded-[12px] border p-4"
          style={{
            background:
              encTone === "positive"
                ? "color-mix(in srgb, var(--positive) 9%, transparent)"
                : encTone === "warn"
                  ? "var(--gold-soft)"
                  : "color-mix(in srgb, var(--brand) 8%, transparent)",
            borderColor:
              encTone === "positive"
                ? "color-mix(in srgb, var(--positive) 30%, transparent)"
                : encTone === "warn"
                  ? "color-mix(in srgb, var(--gold) 38%, transparent)"
                  : "color-mix(in srgb, var(--brand) 30%, transparent)",
          }}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4" aria-hidden />
            ऋण / बंधक कैफ़ियत · Encumbrance
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{enc.detail}</p>
          {enc.status === "mortgaged" && (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              A recorded mortgage does not bar leasing, but the lease terms must account for it —
              the Lease Desk checks this at onboarding.
            </p>
          )}
          {enc.status === "protected_tenure" && (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              FRA pattas are non-transferable; leasing arrangements on such land follow the Act&rsquo;s
              limits and need the Lease Desk&rsquo;s legal check first.
            </p>
          )}
        </section>

        {/* The land */}
        <section>
          <h3 className="eyebrow border-b border-line pb-2">भूमि विवरण · The land</h3>
          <dl className="divide-y divide-line">
            {(
              [
                ["भूमि प्रकार", r.landUse],
                ["मिट्टी", `${r.soilHi} · ${r.soil}`],
                ["सिंचाई", r.irrigation],
                ["वार्षिक लगान", `₹ ${r.revenuePerYear.toLocaleString("en-IN")} / year`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="grid gap-x-8 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                <dt className="eyebrow">{label}</dt>
                <dd className="mt-1 text-sm leading-relaxed sm:mt-0">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Crops */}
        <section>
          <h3 className="eyebrow flex items-center gap-1.5 border-b border-line pb-2">
            <Sprout className="h-3.5 w-3.5" aria-hidden /> फसल प्रविष्टि · Crop survey
          </h3>
          <ul className="divide-y divide-line">
            {r.crops.map((c, i) => (
              <li key={`${i}-${c.crop}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                <div>
                  <p className="text-sm font-medium">{c.crop}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {SEASON_LABEL[c.season] ?? c.season} · {c.irrigated ? "सिंचित (irrigated)" : "असिंचित (rainfed)"}
                  </p>
                </div>
                <span className="readout text-sm">{c.areaHectares.toFixed(2)} ha</span>
              </li>
            ))}
          </ul>
        </section>

        {/* चौहद्दी */}
        <section>
          <h3 className="eyebrow flex items-center gap-1.5 border-b border-line pb-2">
            <Compass className="h-3.5 w-3.5" aria-hidden /> चौहद्दी · Abutting plots
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {(
              [
                ["उत्तर · North", r.boundaries.north],
                ["दक्षिण · South", r.boundaries.south],
                ["पूर्व · East", r.boundaries.east],
                ["पश्चिम · West", r.boundaries.west],
              ] as const
            ).map(([dir, val]) => (
              <div key={dir} className="rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5">
                <p className="eyebrow">{dir}</p>
                <p className="mt-1 leading-relaxed">{val}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mutation */}
        <section>
          <h3 className="eyebrow border-b border-line pb-2">नामांतरण · Mutation history</h3>
          <p className="mt-3 text-sm leading-relaxed">
            <span className="readout">{r.mutation.orderNo}</span> ·{" "}
            {new Date(r.mutation.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{r.mutation.note}</p>
        </section>

        {/* Provenance — always, verbatim from the connector */}
        <footer className="border-t border-line pt-4">
          {note && <p className="max-w-prose text-sm leading-relaxed text-ink-muted">{note}</p>}
          <SatelliteAttribution className="mt-2" />
        </footer>
      </div>
    </article>
  );
}
