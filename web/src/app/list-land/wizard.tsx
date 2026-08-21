"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  FileText,
  IdCard,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  PenLine,
  ScanLine,
  ShieldCheck,
  Sprout,
  Upload,
  Zap,
} from "lucide-react";
import { ParcelOverlayCard, SatelliteAttribution } from "@/components/parcel-overlay-card";
import { JABALPUR } from "@/lib/seed";
import { formatAcres, m2ToAcres, polygonAreaM2, type Position, type Ring } from "@/lib/geo";
import { WATER_LABEL, ROAD_LABEL, type RoadAccess, type WaterSource } from "@/lib/types";
import { VerificationDisclaimer } from "@/components/verification";
import { cn } from "@/lib/cn";

const BoundaryDrawMap = dynamic(
  () => import("@/components/boundary-draw-map").then((m) => m.BoundaryDrawMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-surface-2" /> },
);

/**
 * Land listing wizard — the owner onboarding flow.
 *
 * Six short steps instead of one giant form. Free for landowners, always.
 * The final step hands the completed intake to the Lease Desk (the pilot is
 * deliberately operator-led): nothing here pretends a fully automated
 * publish pipeline exists before it does.
 *
 * Visually this is a survey sheet: a hairline progress rail, editorial step
 * headings, and every measured value — area, coordinates, khasra, term —
 * set as an instrument readout.
 */

const VILLAGE_OPTIONS: { name: string; tehsil: string; at: Position }[] = [
  { name: "Panagar", tehsil: "Panagar", at: [79.9944, 23.2884] },
  { name: "Barela", tehsil: "Jabalpur", at: [80.0857, 23.0961] },
  { name: "Patan", tehsil: "Patan", at: [79.6889, 23.2833] },
  { name: "Sihora", tehsil: "Sihora", at: [80.1046, 23.4869] },
  { name: "Kundam", tehsil: "Kundam", at: [80.3234, 23.4211] },
  { name: "Bargi", tehsil: "Jabalpur", at: [79.9312, 23.0489] },
  { name: "Majholi", tehsil: "Majholi", at: [79.9045, 23.4998] },
  { name: "Shahpura", tehsil: "Shahpura", at: [79.6512, 23.1608] },
  { name: "Tilwara", tehsil: "Jabalpur", at: [79.9231, 23.1122] },
  { name: "Belkhera", tehsil: "Panagar", at: [80.0421, 23.2411] },
  { name: "Khamaria", tehsil: "Jabalpur", at: [79.9701, 23.2265] },
  { name: "Gosalpur", tehsil: "Sihora", at: [80.0512, 23.3866] },
  { name: "Other / not listed", tehsil: "", at: JABALPUR },
];

const STEPS = ["Locate", "Boundary", "Details", "Infrastructure", "Agriculture", "Documents"] as const;

/** Editorial heading for each step: icon, title, and the one line of guidance. */
const STEP_INTRO = [
  {
    icon: <MapPin className="h-4 w-4" aria-hidden />,
    title: "Where is the land?",
    blurb:
      "Start with the village. The next step opens satellite imagery over it, so you can find your field from the air.",
  },
  {
    icon: <PenLine className="h-4 w-4" aria-hidden />,
    title: "Draw the boundary",
    // The honesty copy lives here so the instruction and the caveat are read
    // as one thing: what you draw is owner-drawn until someone walks it.
    blurb: (
      <>
        Tap each corner of your field on the imagery. Drag a corner to adjust it. The area updates
        live and is saved as an{" "}
        <strong className="font-semibold text-ink">owner-drawn boundary</strong> — our field
        executive confirms it on the ground before the parcel is marked as walked.
      </>
    ),
  },
  {
    icon: <FileText className="h-4 w-4" aria-hidden />,
    title: "Land details",
    blurb:
      "The khasra number is the only field we truly need. Everything else helps a farmer decide faster.",
  },
  {
    icon: <Zap className="h-4 w-4" aria-hidden />,
    title: "Water, power & access",
    blurb:
      "Water and reach set the rent more than anything else on this form. Say exactly what is there today.",
  },
  {
    icon: <Sprout className="h-4 w-4" aria-hidden />,
    title: "Soil & crops",
    blurb: "What the land has grown recently tells a farmer what it can grow next season.",
  },
  {
    icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
    title: "Documents & contact",
    blurb: "The last step — then your intake goes to the Lease Desk and we schedule the field visit.",
  },
];

/** One parcel returned by the land-records connector. */
interface RecordChoice {
  khasraNumber?: string;
  village?: string;
  areaAcres?: number;
  geometry?: Ring[];
  recordedOwnerName?: string;
  ulpin?: string;
}

interface FormState {
  village: string;
  tehsil: string;
  boundary: Ring;
  areaAcres: number;
  khasra: string;
  bhuswamiId: string;
  declaredAcres: string;
  currentUsage: string;
  leaseYears: string;
  expectedRentPerAcre: string;
  water: WaterSource[];
  electricity: "yes" | "no" | "";
  road: RoadAccess | "";
  soil: string;
  previousCrops: string;
  irrigation: string;
  organic: boolean;
  docs: { khasra: boolean; khatauni: boolean; ownership: boolean; identity: boolean };
  ownerName: string;
  ownerPhone: string;
}

const initial: FormState = {
  village: "",
  tehsil: "",
  boundary: [],
  areaAcres: 0,
  khasra: "",
  bhuswamiId: "",
  declaredAcres: "",
  currentUsage: "",
  leaseYears: "3",
  expectedRentPerAcre: "",
  water: [],
  electricity: "",
  road: "",
  soil: "",
  previousCrops: "",
  irrigation: "",
  organic: false,
  docs: { khasra: false, khatauni: false, ownership: false, identity: false },
  ownerName: "",
  ownerPhone: "",
};

const labelCls = "mb-2 block text-sm font-medium text-ink";
const hintCls = "mt-2 max-w-prose text-xs leading-relaxed text-ink-muted";
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Values in the final summary that are measurements, not prose. */
const MEASURED_LABELS = new Set(["Khasra", "Drawn boundary", "Area on record", "Preferred lease"]);

function Req() {
  return <span className="ml-0.5 text-brand">*</span>;
}

/** Editorial step heading: quiet eyebrow, serif title, one line of guidance. */
function StepHead({
  index,
  title,
  blurb,
  icon,
  action,
}: {
  index: number;
  title: string;
  blurb?: React.ReactNode;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-brand">
            {icon}
          </span>
          <p className="eyebrow">
            Step {pad2(index + 1)} · {STEPS[index]}
          </p>
        </div>
        <h2 className="display mt-4 text-xl">{title}</h2>
        {blurb && <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">{blurb}</p>}
      </div>
      {action}
    </header>
  );
}

/** A hairline cell of measured facts — the survey sheet's readout strip. */
function FactGrid({ children, cols }: { children: React.ReactNode; cols: string }) {
  return (
    <dl className={cn("grid gap-px overflow-hidden rounded-lg border border-line bg-line", cols)}>
      {children}
    </dl>
  );
}

function Fact({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn("mt-1.5 text-sm font-medium text-ink", mono && "readout")}>{value}</dd>
    </div>
  );
}

export function ListLandWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Consent-based land-record lookup for THIS parcel only. No bulk data, no
  // owner-name search: the owner names their own khasra and attests to it.
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordNote, setRecordNote] = useState<string | null>(null);
  const [recordChoices, setRecordChoices] = useState<RecordChoice[]>([]);

  async function fetchLandRecord(kind: "khasra" | "bhuswami") {
    setRecordBusy(true);
    setRecordNote(null);
    setRecordChoices([]);
    try {
      const v = VILLAGE_OPTIONS.find((x) => x.name === form.village);
      const res = await fetch("/api/land-records/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: "Madhya Pradesh",
          district: "Jabalpur",
          tehsil: v?.tehsil || undefined,
          village: kind === "khasra" ? form.village : undefined,
          khasraNumber: kind === "khasra" ? form.khasra.trim() : undefined,
          bhuswamiId: kind === "bhuswami" ? form.bhuswamiId.trim() : undefined,
          consentGiven: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecordNote(data.error ?? "Could not reach the land-records service.");
        return;
      }
      const parcels: RecordChoice[] = data.parcels ?? [];
      if (!data.found || parcels.length === 0) {
        setRecordNote(
          data.note ??
            "No connected land-records source yet. Your details stay owner-supplied until our team verifies them.",
        );
        return;
      }
      const source = `${String(data.provider).replace(/_/g, " ")}` +
        (data.isAuthoritative ? " (authorised source)" : " (unverified source)");
      if (parcels.length === 1) {
        applyRecord(parcels[0]);
        setRecordNote(`Record found via ${source}.` + (parcels[0].geometry ? " Surveyed boundary loaded — check it on the boundary step." : ""));
      } else {
        setRecordChoices(parcels);
        setRecordNote(`${parcels.length} parcels found via ${source}. Choose the one you want to lease.`);
      }
    } catch {
      setRecordNote("Could not reach the land-records service.");
    } finally {
      setRecordBusy(false);
    }
  }

  function applyRecord(rec: RecordChoice) {
    if (rec.geometry?.[0]) {
      set("boundary", rec.geometry[0]);
      set("areaAcres", Number(rec.areaAcres ?? m2ToAcres(polygonAreaM2(rec.geometry))));
    }
    if (rec.khasraNumber) set("khasra", rec.khasraNumber);
    if (rec.areaAcres) set("declaredAcres", String(rec.areaAcres));
    if (rec.village) {
      const match = VILLAGE_OPTIONS.find((v) => v.name.toLowerCase() === rec.village!.toLowerCase());
      if (match) {
        set("village", match.name);
        set("tehsil", match.tehsil);
      }
    }
    setRecordChoices([]);
  }

  // Upload the khasra copy and read the details off it. Everything returned is
  // a suggestion the owner confirms; the file itself is never stored.
  const [scanBusy, setScanBusy] = useState(false);

  async function scanKhasraCopy(file: File) {
    setScanBusy(true);
    setRecordNote(null);
    setRecordChoices([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/land-records/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setRecordNote(data.error ?? "Could not read that file.");
        return;
      }
      const x = data.extraction ?? {};
      const filled: string[] = [];
      if (x.khasraNumber) { set("khasra", x.khasraNumber); filled.push("khasra number"); }
      if (x.bhuswamiId) { set("bhuswamiId", x.bhuswamiId); filled.push("Bhu-Swami ID"); }
      if (x.areaAcres) { set("declaredAcres", String(x.areaAcres)); filled.push("area"); }
      if (x.village) {
        const match = VILLAGE_OPTIONS.find(
          (v) => v.name.toLowerCase() === String(x.village).toLowerCase(),
        );
        if (match) {
          set("village", match.name);
          set("tehsil", match.tehsil);
          filled.push("village (map moved there)");
        } else {
          filled.push(`village "${x.village}" — pick the closest match above`);
        }
      }
      if (x.ownerName && !form.ownerName) { set("ownerName", x.ownerName); filled.push("owner name"); }

      setRecordNote(
        filled.length
          ? `Read from your copy: ${filled.join(", ")}. Please check each value — nothing is saved until you continue. Your document was not stored.`
          : (data.note ?? "Could not find the usual fields on that copy. Please type them in."),
      );
    } catch {
      setRecordNote("Could not read that file.");
    } finally {
      setScanBusy(false);
    }
  }

  const center = useMemo<Position>(() => {
    const v = VILLAGE_OPTIONS.find((v) => v.name === form.village);
    return v?.at ?? JABALPUR;
  }, [form.village]);

  const canNext = [
    form.village !== "",
    form.boundary.length >= 4, // closed ring
    form.khasra.trim() !== "",
    form.water.length > 0 && form.electricity !== "" && form.road !== "",
    form.soil.trim() !== "",
    form.ownerName.trim() !== "" && form.ownerPhone.trim().length >= 10,
  ][step];

  const geojson = useMemo(() => {
    if (form.boundary.length < 4) return null;
    return JSON.stringify(
      {
        type: "Feature",
        properties: {
          village: form.village,
          khasra: form.khasra || undefined,
          area_acres: +form.areaAcres.toFixed(3),
          boundary_source: "owner_drawn",
        },
        geometry: { type: "Polygon", coordinates: [form.boundary] },
      },
      null,
      2,
    );
  }, [form.boundary, form.village, form.khasra, form.areaAcres]);

  function importGeoJSON(file: File) {
    file.text().then((t) => {
      try {
        const parsed = JSON.parse(t);
        const geom =
          parsed.type === "Feature" ? parsed.geometry :
          parsed.type === "FeatureCollection" ? parsed.features?.[0]?.geometry :
          parsed;
        const ring: Ring | undefined =
          geom?.type === "Polygon" ? geom.coordinates?.[0] :
          geom?.type === "MultiPolygon" ? geom.coordinates?.[0]?.[0] : undefined;
        if (ring && ring.length >= 4) {
          set("boundary", ring);
          set("areaAcres", m2ToAcres(polygonAreaM2([ring])));
        } else {
          alert("Could not find a polygon in that file.");
        }
      } catch {
        alert("That file is not valid GeoJSON.");
      }
    });
  }

  const summaryLines = [
    `Village: ${form.village}${form.tehsil ? `, ${form.tehsil} tehsil` : ""}`,
    `Khasra: ${form.khasra}`,
    `Drawn boundary: ${form.boundary.length - 1} corners, ~${formatAcres(form.areaAcres)} acres`,
    form.declaredAcres && `Area on record: ${form.declaredAcres} acres`,
    `Water: ${form.water.map((w) => WATER_LABEL[w]).join(", ") || "—"}`,
    `Electricity: ${form.electricity || "—"} · Road: ${form.road ? ROAD_LABEL[form.road as RoadAccess] : "—"}`,
    `Soil: ${form.soil} · Previous crops: ${form.previousCrops || "—"}`,
    `Preferred lease: ${form.leaseYears} years` +
      (form.expectedRentPerAcre ? ` · Expected rent: ₹${form.expectedRentPerAcre}/acre/yr` : ""),
    `Documents in hand: ${Object.entries(form.docs).filter(([, v]) => v).map(([k]) => k).join(", ") || "none yet"}`,
    `Owner: ${form.ownerName} · ${form.ownerPhone}`,
  ].filter(Boolean);

  const waMessage = encodeURIComponent(
    `Namaste FarmKaro — main apni zameen list karna chahta/chahti hoon.\n\n${summaryLines.join("\n")}\n\n(Sent from farmkaro.in listing form)`,
  );

  // ── Confirmation ─────────────────────────────────────────────────────────
  if (submitted) {
    const corners = Math.max(0, form.boundary.length - 1);
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="card overflow-hidden shadow-lg rise">
          {form.boundary.length >= 4 && (
            <div className="relative h-[220px] border-b border-line sm:h-[280px]">
              <ParcelOverlayCard
                geometry={[form.boundary]}
                boundaryConfirmed
                pad={2.4}
                rounded="rounded-none"
                className="h-full w-full"
              />
              <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-2">
                <span className="glass rounded-full px-3 py-1.5 text-xs font-medium text-white">
                  Owner-drawn boundary · not yet walked
                </span>
                <span className="glass flex items-baseline gap-1.5 rounded-xl px-3 py-2">
                  <span className="readout text-md font-semibold text-white">
                    {formatAcres(form.areaAcres)}
                  </span>
                  <span className="text-xs text-white/70">acres</span>
                </span>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-10">
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand"
                style={{
                  background: "color-mix(in srgb, var(--brand) 16%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--brand) 40%, transparent)",
                }}
              >
                <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
              </span>
              <p className="eyebrow">Intake complete</p>
            </div>

            <h1 className="display mt-5 text-2xl">Details ready for the Lease Desk</h1>
            <p className="mt-4 max-w-prose text-md leading-relaxed text-ink-muted">
              During the Jabalpur pilot, every new parcel is onboarded by a FarmKaro field executive —
              we walk the boundary with you, check the papers in person, and only then does the parcel
              go live. Send your details on WhatsApp and we&rsquo;ll schedule the visit.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={`https://wa.me/919467871448?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary px-6 py-3"
              >
                <MessageCircle className="h-4 w-4" aria-hidden /> Send on WhatsApp
              </a>
              {geojson && (
                <a
                  href={`data:application/geo+json;charset=utf-8,${encodeURIComponent(geojson)}`}
                  download={`farmkaro-boundary-${form.khasra.replace(/\W+/g, "-") || "parcel"}.geojson`}
                  className="btn btn-ghost px-5 py-3"
                >
                  <Download className="h-4 w-4" aria-hidden /> Download boundary (GeoJSON)
                </a>
              )}
            </div>

            <div className="mt-8">
              <FactGrid cols="sm:grid-cols-3">
                <Fact label="Village" value={form.village || "—"} mono={false} />
                <Fact label="Corners drawn" value={String(corners)} />
                <Fact label="Drawn area" value={`${formatAcres(form.areaAcres)} ac`} />
              </FactGrid>
            </div>

            {form.boundary.length >= 4 && <SatelliteAttribution className="mt-3" />}
          </div>
        </div>

        <div className="card ticks mt-6 p-5 rise sm:p-7" style={{ animationDelay: "90ms" }}>
          <p className="eyebrow">What you shared</p>
          <dl className="mt-4 divide-y divide-line">
            {summaryLines.map((line) => {
              const at = line.indexOf(": ");
              const label = at > 0 ? line.slice(0, at) : line;
              const value = at > 0 ? line.slice(at + 2) : "";
              return (
                <div
                  key={line}
                  className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 py-3"
                >
                  <dt className="text-xs text-ink-faint">{label}</dt>
                  <dd
                    className={cn(
                      "text-right text-sm text-ink",
                      MEASURED_LABELS.has(label) && "readout",
                    )}
                  >
                    {value || "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <VerificationDisclaimer className="mt-5 border-t border-line pt-4" />
        </div>
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  const intro = STEP_INTRO[step];

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
      <header className="rise">
        <p className="eyebrow">Landowner intake · Jabalpur pilot</p>
        <h1 className="display mt-4 text-2xl">List your land</h1>
        <p className="mt-4 max-w-[58ch] text-md leading-relaxed text-ink-muted">
          Six short steps. Free for landowners — always. Leases arranged through FarmKaro use the
          state framework, carry a fixed end date, and create no tenancy rights.
        </p>
      </header>

      {/* Progress rail — a survey scale, not a row of pills. */}
      <nav className="mt-10 rise" style={{ animationDelay: "80ms" }} aria-label="Progress">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="eyebrow">Progress</p>
          <p className="readout text-xs text-ink-faint">
            {pad2(step + 1)} / {pad2(STEPS.length)}
          </p>
        </div>
        <ol className="grid grid-cols-6 gap-x-2 sm:gap-x-4">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "focus-ring group block w-full text-left",
                    done && "cursor-pointer",
                    i > step && "cursor-default",
                  )}
                >
                  <span
                    aria-hidden
                    className="block h-[2px] w-full rounded-full transition-colors"
                    style={{
                      background: current
                        ? "var(--brand)"
                        : done
                          ? "color-mix(in srgb, var(--brand) 42%, transparent)"
                          : "var(--line)",
                    }}
                  />
                  <span className="mt-3 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "readout inline-flex w-5 shrink-0 items-center text-xs",
                        current ? "font-semibold text-brand" : done ? "text-ink-muted" : "text-ink-faint",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : pad2(i + 1)}
                    </span>
                    <span
                      className={cn(
                        "hidden truncate text-xs sm:inline",
                        current
                          ? "font-semibold text-ink"
                          : done
                            ? "text-ink-muted group-hover:text-ink"
                            : "text-ink-faint",
                      )}
                    >
                      {s}
                    </span>
                    <span className="sr-only sm:hidden">{s}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="card mt-6 p-5 rise sm:p-8" style={{ animationDelay: "140ms" }}>
        {/* Re-keyed per step so each panel settles in rather than snapping. */}
        <div key={step} className="rise">
          {step === 0 && (
            <div>
              <StepHead index={0} icon={intro.icon} title={intro.title} blurb={intro.blurb} />
              <div className="max-w-md">
                <label htmlFor="village" className={labelCls}>
                  Village
                </label>
                <select
                  id="village"
                  className="field"
                  value={form.village}
                  onChange={(e) => {
                    const v = VILLAGE_OPTIONS.find((x) => x.name === e.target.value);
                    set("village", e.target.value);
                    set("tehsil", v?.tehsil ?? "");
                  }}
                >
                  <option value="">Select village…</option>
                  {VILLAGE_OPTIONS.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                      {v.tehsil ? ` — ${v.tehsil} tehsil` : ""}
                    </option>
                  ))}
                </select>
                <p className={hintCls}>
                  The pilot covers Jabalpur district. Other districts join as the Lease Desk expands.
                </p>
              </div>

              {form.village && (
                <div className="mt-8 max-w-2xl fade-in">
                  <FactGrid cols="sm:grid-cols-3">
                    <Fact label="Tehsil" value={form.tehsil || "—"} mono={false} />
                    <Fact label="District" value="Jabalpur, MP" mono={false} />
                    <Fact
                      label="Map centre"
                      value={`${center[1].toFixed(4)}°N ${center[0].toFixed(4)}°E`}
                    />
                  </FactGrid>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <StepHead
                index={1}
                icon={intro.icon}
                title={intro.title}
                blurb={intro.blurb}
                action={
                  <label className="btn btn-ghost cursor-pointer">
                    <Upload className="h-4 w-4" aria-hidden /> Import GeoJSON
                    <input
                      type="file"
                      accept=".json,.geojson,application/geo+json,application/json"
                      className="sr-only"
                      onChange={(e) => e.target.files?.[0] && importGeoJSON(e.target.files[0])}
                    />
                  </label>
                }
              />

              <div className="overflow-hidden rounded-lg border border-line-strong shadow-md">
                <BoundaryDrawMap
                  center={center}
                  value={form.boundary.length ? form.boundary.slice(0, -1) : undefined}
                  onChange={(ring, acres) => {
                    set("boundary", ring);
                    set("areaAcres", acres);
                  }}
                  className="h-[440px] sm:h-[560px]"
                />
              </div>

              <div className="mt-4">
                <FactGrid cols="sm:grid-cols-3">
                  <Fact
                    label="Corners placed"
                    value={String(Math.max(0, form.boundary.length - 1))}
                  />
                  <Fact
                    label="Drawn area"
                    value={form.boundary.length >= 4 ? `${formatAcres(form.areaAcres)} ac` : "—"}
                  />
                  <Fact label="Boundary source" value="Owner-drawn" mono={false} />
                </FactGrid>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <StepHead index={2} icon={intro.icon} title={intro.title} blurb={intro.blurb} />

              {/* Hero action: read the parcel straight off the owner's own copy. */}
              <div
                className="card ticks grid-paper p-5 sm:p-6"
                style={{ backgroundColor: "color-mix(in srgb, var(--brand) 6%, var(--surface))" }}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface text-brand">
                    <ScanLine className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="display text-lg">Have your khasra copy? Upload it.</h3>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
                      We read the khasra number, village and area straight off the document and point
                      the map at it. Your copy is not stored.
                    </p>
                    <label className="btn btn-primary mt-4 cursor-pointer px-5 py-2.5">
                      {scanBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden />
                      )}
                      {scanBusy ? "Reading…" : "Upload khasra copy (PDF or photo)"}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void scanKhasraCopy(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="readout mt-3 text-xs text-ink-faint">PDF · JPG · PNG · WEBP</p>
                  </div>
                </div>
              </div>

              {/* From the record */}
              <section className="mt-9 max-w-2xl border-t border-line pt-7">
                <p className="eyebrow">From the land record</p>

                <div className="mt-4">
                  <label htmlFor="khasra" className={labelCls}>
                    Khasra number
                    <Req />
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="khasra"
                      className="field readout min-w-0 flex-1"
                      placeholder="e.g. 214/3"
                      value={form.khasra}
                      onChange={(e) => set("khasra", e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={recordBusy || form.khasra.trim() === "" || form.village === ""}
                      onClick={() => void fetchLandRecord("khasra")}
                      className="btn btn-ghost shrink-0"
                    >
                      {recordBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <FileSearch className="h-4 w-4" aria-hidden />
                      )}
                      Fetch my record
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor="bhuswami" className={labelCls}>
                    …or fetch all your land with your Bhu-Swami ID
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="bhuswami"
                      className="field readout min-w-0 flex-1"
                      placeholder="Bhu-Swami (landholder) ID"
                      value={form.bhuswamiId}
                      onChange={(e) => set("bhuswamiId", e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={recordBusy || form.bhuswamiId.trim() === ""}
                      onClick={() => void fetchLandRecord("bhuswami")}
                      className="btn btn-ghost shrink-0"
                    >
                      {recordBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <IdCard className="h-4 w-4" aria-hidden />
                      )}
                      Fetch my land
                    </button>
                  </div>
                </div>

                <div aria-live="polite">
                  {recordNote && (
                    <p className="mt-4 flex gap-2.5 rounded-lg border border-line bg-surface-2 p-3.5 text-xs leading-relaxed text-ink-muted">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
                      <span>{recordNote}</span>
                    </p>
                  )}

                  {recordChoices.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {recordChoices.map((rec, i) => (
                        <li key={`${rec.khasraNumber ?? i}`}>
                          <button
                            type="button"
                            onClick={() => applyRecord(rec)}
                            className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                          >
                            <span>
                              <span className="text-sm font-semibold text-ink">
                                Khasra <span className="readout">{rec.khasraNumber ?? "—"}</span>
                              </span>
                              {rec.village && (
                                <span className="ml-2 text-xs text-ink-muted">{rec.village}</span>
                              )}
                            </span>
                            <span className="readout text-xs text-ink-faint">
                              {rec.areaAcres ? `${rec.areaAcres} ac` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Owner-stated details */}
              <section className="mt-9 max-w-2xl border-t border-line pt-7">
                <p className="eyebrow">About the parcel</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="declared" className={labelCls}>
                      Area on record (acres)
                    </label>
                    <input
                      id="declared"
                      type="number"
                      min="0"
                      step="0.01"
                      className="field readout"
                      placeholder={form.areaAcres ? `Drawn: ${formatAcres(form.areaAcres)}` : "e.g. 4.5"}
                      value={form.declaredAcres}
                      onChange={(e) => set("declaredAcres", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="usage" className={labelCls}>
                      Current usage
                    </label>
                    <input
                      id="usage"
                      className="field"
                      placeholder="e.g. fallow since last rabi"
                      value={form.currentUsage}
                      onChange={(e) => set("currentUsage", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="years" className={labelCls}>
                      Preferred lease duration
                    </label>
                    <select
                      id="years"
                      className="field readout"
                      value={form.leaseYears}
                      onChange={(e) => set("leaseYears", e.target.value)}
                    >
                      {["1", "2", "3", "5", "7", "9"].map((y) => (
                        <option key={y} value={y}>
                          {y} year{y === "1" ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rent" className={labelCls}>
                      Expected rent (₹/acre/year, optional)
                    </label>
                    <input
                      id="rent"
                      type="number"
                      min="0"
                      step="500"
                      className="field readout"
                      placeholder="e.g. 15000"
                      value={form.expectedRentPerAcre}
                      onChange={(e) => set("expectedRentPerAcre", e.target.value)}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-2xl">
              <StepHead index={3} icon={intro.icon} title={intro.title} blurb={intro.blurb} />

              <fieldset>
                <legend className={labelCls}>
                  Water sources
                  <Req />
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(WATER_LABEL) as WaterSource[]).map((w) => {
                    const on = form.water.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          set("water", on ? form.water.filter((x) => x !== w) : [...form.water, w])
                        }
                        className={cn(
                          "focus-ring rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          on
                            ? "border-brand bg-brand text-brand-ink"
                            : "border-line-strong bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
                        )}
                      >
                        {WATER_LABEL[w]}
                      </button>
                    );
                  })}
                </div>
                <p className={hintCls}>Choose all that apply.</p>
              </fieldset>

              <div className="mt-8 grid gap-5 border-t border-line pt-7 sm:grid-cols-2">
                <div>
                  <label htmlFor="power" className={labelCls}>
                    Electricity connection
                    <Req />
                  </label>
                  <select
                    id="power"
                    className="field"
                    value={form.electricity}
                    onChange={(e) => set("electricity", e.target.value as FormState["electricity"])}
                  >
                    <option value="">Select…</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="road" className={labelCls}>
                    Road access
                    <Req />
                  </label>
                  <select
                    id="road"
                    className="field"
                    value={form.road}
                    onChange={(e) => set("road", e.target.value as FormState["road"])}
                  >
                    <option value="">Select…</option>
                    {(Object.keys(ROAD_LABEL) as RoadAccess[]).map((r) => (
                      <option key={r} value={r}>
                        {ROAD_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-2xl">
              <StepHead index={4} icon={intro.icon} title={intro.title} blurb={intro.blurb} />

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="soil" className={labelCls}>
                    Soil type
                    <Req />
                  </label>
                  <input
                    id="soil"
                    className="field"
                    placeholder="e.g. black cotton (kali)"
                    value={form.soil}
                    onChange={(e) => set("soil", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="prev" className={labelCls}>
                    Crops grown recently
                  </label>
                  <input
                    id="prev"
                    className="field"
                    placeholder="e.g. soybean, wheat"
                    value={form.previousCrops}
                    onChange={(e) => set("previousCrops", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="irrig" className={labelCls}>
                    Irrigation setup
                  </label>
                  <input
                    id="irrig"
                    className="field"
                    placeholder="e.g. borewell + drip on 3 acres"
                    value={form.irrigation}
                    onChange={(e) => set("irrigation", e.target.value)}
                  />
                </div>
              </div>

              <label
                className={cn(
                  "mt-6 flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition-colors",
                  form.organic
                    ? "border-line-strong bg-surface-2"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <input
                  type="checkbox"
                  checked={form.organic}
                  onChange={(e) => set("organic", e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--brand)]"
                />
                <span>
                  <span className="font-medium text-ink">Farmed organically (no chemical inputs)</span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                    Owner-stated. Nothing here claims a certification we have not seen.
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="max-w-2xl">
              <StepHead index={5} icon={intro.icon} title={intro.title} blurb={intro.blurb} />

              <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
                Tick what you have in hand — you don&rsquo;t upload anything here. Our field executive
                photographs documents during the visit, and each one shows on your parcel as{" "}
                <em>uploaded</em>, then <em>under review</em>, then <em>reviewed by FarmKaro</em>.
                Upload and verification are never the same thing.
              </p>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    ["khasra", "Khasra (B-1)"],
                    ["khatauni", "Khatauni extract"],
                    ["ownership", "Ownership proof"],
                    ["identity", "Owner ID"],
                  ] as const
                ).map(([k, label]) => (
                  <label
                    key={k}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3.5 text-sm transition-colors",
                      form.docs[k]
                        ? "border-line-strong bg-surface-2 text-ink"
                        : "border-line bg-surface text-ink-muted hover:border-line-strong",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.docs[k]}
                      onChange={(e) => set("docs", { ...form.docs, [k]: e.target.checked })}
                      className="h-4 w-4 shrink-0 accent-[color:var(--brand)]"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-8 grid gap-5 border-t border-line pt-7 sm:grid-cols-2">
                <div>
                  <label htmlFor="oname" className={labelCls}>
                    Your name
                    <Req />
                  </label>
                  <input
                    id="oname"
                    className="field"
                    value={form.ownerName}
                    onChange={(e) => set("ownerName", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="ophone" className={labelCls}>
                    Phone (WhatsApp)
                    <Req />
                  </label>
                  <input
                    id="ophone"
                    type="tel"
                    inputMode="tel"
                    className="field readout"
                    placeholder="10-digit mobile"
                    value={form.ownerPhone}
                    onChange={(e) => set("ownerPhone", e.target.value)}
                  />
                </div>
              </div>

              <VerificationDisclaimer className="mt-7 rounded-lg border border-line bg-surface-2 p-4" />
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn btn-ghost"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back
          </button>
          <div className="flex items-center gap-4">
            {!canNext && (
              <span className="hidden items-center gap-1.5 text-xs text-ink-faint sm:flex">
                <Info className="h-3.5 w-3.5" aria-hidden />
                {step === 1 ? "Place at least 3 corners to continue" : "Fill the required fields"}
              </span>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="btn btn-primary px-6 py-3"
              >
                Continue <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSubmitted(true)}
                disabled={!canNext}
                className="btn btn-primary px-6 py-3"
              >
                Review &amp; send <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
