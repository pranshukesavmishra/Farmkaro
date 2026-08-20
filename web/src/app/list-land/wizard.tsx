"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Info,
  MapPin,
  MessageCircle,
  Sprout,
  Upload,
  Zap,
} from "lucide-react";
import { JABALPUR } from "@/lib/seed";
import { formatAcres, m2ToAcres, polygonAreaM2, type Position, type Ring } from "@/lib/geo";
import { WATER_LABEL, ROAD_LABEL, type RoadAccess, type WaterSource } from "@/lib/types";
import { Badge } from "@/components/ui";
import { VerificationDisclaimer } from "@/components/verification";
import { cn } from "@/lib/cn";

const BoundaryDrawMap = dynamic(
  () => import("@/components/boundary-draw-map").then((m) => m.BoundaryDrawMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-[var(--line)]/60" /> },
);

/**
 * Land listing wizard — the owner onboarding flow.
 *
 * Six short steps instead of one giant form. Free for landowners, always.
 * The final step hands the completed intake to the Lease Desk (the pilot is
 * deliberately operator-led): nothing here pretends a fully automated
 * publish pipeline exists before it does.
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

interface FormState {
  village: string;
  tehsil: string;
  boundary: Ring;
  areaAcres: number;
  khasra: string;
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

const inputCls =
  "surface focus-ring w-full rounded-lg border px-3 py-2.5 text-[14px] placeholder:text-[var(--fg-muted)]";
const labelCls = "mb-1.5 block text-[12.5px] font-medium muted";

export function ListLandWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-forest-500/15 text-forest-500 dark:text-forest-300">
          <Check className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">Details ready for the Lease Desk</h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-[15px] muted">
          During the Jabalpur pilot, every new parcel is onboarded by a FarmKaro field executive —
          we walk the boundary with you, check the papers in person, and only then does the parcel
          go live. Send your details on WhatsApp and we&rsquo;ll schedule the visit.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`https://wa.me/919467871448?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex items-center gap-2 rounded-full bg-forest-900 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-forest-700 dark:bg-forest-500"
          >
            <MessageCircle className="h-4 w-4" /> Send on WhatsApp
          </a>
          {geojson && (
            <a
              href={`data:application/geo+json;charset=utf-8,${encodeURIComponent(geojson)}`}
              download={`farmkaro-boundary-${form.khasra.replace(/\W+/g, "-") || "parcel"}.geojson`}
              className="focus-ring inline-flex items-center gap-2 rounded-full border hairline px-5 py-2.5 text-[14px] font-medium hover:bg-[var(--surface)]"
            >
              <Download className="h-4 w-4" /> Download boundary (GeoJSON)
            </a>
          )}
        </div>
        <div className="surface mx-auto mt-8 max-w-xl rounded-xl border p-4 text-left">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.09em] muted">What you shared</p>
          <ul className="space-y-1 text-[13px]">
            {summaryLines.map((l) => (
              <li key={l} className="muted">{l}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">List your land</h1>
        <p className="mt-1.5 max-w-[62ch] text-[14.5px] muted">
          Six short steps. Free for landowners — always. Leases arranged through FarmKaro use the
          state framework, carry a fixed end date, and create no tenancy rights.
        </p>
      </header>

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "focus-ring flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
                i === step
                  ? "border-forest-900 bg-forest-900 text-white dark:border-forest-500 dark:bg-forest-500"
                  : i < step
                    ? "hairline surface text-forest-500 dark:text-forest-300"
                    : "hairline surface muted opacity-60",
              )}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span className="font-mono">{i + 1}</span>}
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="surface rounded-2xl border p-5 sm:p-7">
        {step === 0 && (
          <div className="max-w-xl space-y-5">
            <div className="flex items-center gap-2 text-forest-500 dark:text-forest-300">
              <MapPin className="h-5 w-5" />
              <h2 className="text-[18px] font-semibold">Where is the land?</h2>
            </div>
            <div>
              <label htmlFor="village" className={labelCls}>Village</label>
              <select
                id="village"
                className={inputCls}
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
                    {v.name}{v.tehsil ? ` — ${v.tehsil} tehsil` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[12.5px] muted">
                The pilot covers Jabalpur district. Other districts join as the Lease Desk expands.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold">Draw the boundary</h2>
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full border hairline px-3.5 py-1.5 text-[12.5px] font-medium hover:bg-[var(--bg)]">
                <Upload className="h-3.5 w-3.5" /> Import GeoJSON
                <input
                  type="file"
                  accept=".json,.geojson,application/geo+json,application/json"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && importGeoJSON(e.target.files[0])}
                />
              </label>
            </div>
            <p className="text-[13.5px] muted">
              Tap each corner of your field on the imagery. Drag a corner to adjust it. The area
              updates live and is saved as an <strong>owner-drawn boundary</strong> — our field
              executive confirms it on the ground before the parcel is marked as walked.
            </p>
            <BoundaryDrawMap
              center={center}
              value={form.boundary.length ? form.boundary.slice(0, -1) : undefined}
              onChange={(ring, acres) => {
                set("boundary", ring);
                set("areaAcres", acres);
              }}
              className="h-[420px] overflow-hidden rounded-xl"
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2 text-forest-500 dark:text-forest-300">
              <FileText className="h-5 w-5" />
              <h2 className="text-[18px] font-semibold">Land details</h2>
            </div>
            <div>
              <label htmlFor="khasra" className={labelCls}>Khasra number *</label>
              <input id="khasra" className={inputCls} placeholder="e.g. 214/3"
                value={form.khasra} onChange={(e) => set("khasra", e.target.value)} />
            </div>
            <div>
              <label htmlFor="declared" className={labelCls}>Area on record (acres)</label>
              <input id="declared" type="number" min="0" step="0.01" className={inputCls}
                placeholder={form.areaAcres ? `Drawn: ${formatAcres(form.areaAcres)}` : "e.g. 4.5"}
                value={form.declaredAcres} onChange={(e) => set("declaredAcres", e.target.value)} />
            </div>
            <div>
              <label htmlFor="usage" className={labelCls}>Current usage</label>
              <input id="usage" className={inputCls} placeholder="e.g. fallow since last rabi"
                value={form.currentUsage} onChange={(e) => set("currentUsage", e.target.value)} />
            </div>
            <div>
              <label htmlFor="years" className={labelCls}>Preferred lease duration</label>
              <select id="years" className={inputCls} value={form.leaseYears}
                onChange={(e) => set("leaseYears", e.target.value)}>
                {["1", "2", "3", "5", "7", "9"].map((y) => (
                  <option key={y} value={y}>{y} year{y === "1" ? "" : "s"}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rent" className={labelCls}>Expected rent (₹/acre/year, optional)</label>
              <input id="rent" type="number" min="0" step="500" className={inputCls} placeholder="e.g. 15000"
                value={form.expectedRentPerAcre} onChange={(e) => set("expectedRentPerAcre", e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center gap-2 text-forest-500 dark:text-forest-300">
              <Zap className="h-5 w-5" />
              <h2 className="text-[18px] font-semibold">Water, power &amp; access</h2>
            </div>
            <fieldset>
              <legend className={labelCls}>Water sources *</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WATER_LABEL) as WaterSource[]).map((w) => {
                  const on = form.water.includes(w);
                  return (
                    <button key={w} type="button" aria-pressed={on}
                      onClick={() =>
                        set("water", on ? form.water.filter((x) => x !== w) : [...form.water, w])
                      }
                      className={cn(
                        "focus-ring rounded-full border px-3.5 py-1.5 text-[13px] font-medium",
                        on
                          ? "border-forest-900 bg-forest-900 text-white dark:border-forest-500 dark:bg-forest-500"
                          : "hairline surface",
                      )}>
                      {WATER_LABEL[w]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="power" className={labelCls}>Electricity connection *</label>
                <select id="power" className={inputCls} value={form.electricity}
                  onChange={(e) => set("electricity", e.target.value as FormState["electricity"])}>
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label htmlFor="road" className={labelCls}>Road access *</label>
                <select id="road" className={inputCls} value={form.road}
                  onChange={(e) => set("road", e.target.value as FormState["road"])}>
                  <option value="">Select…</option>
                  {(Object.keys(ROAD_LABEL) as RoadAccess[]).map((r) => (
                    <option key={r} value={r}>{ROAD_LABEL[r]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2 text-forest-500 dark:text-forest-300">
              <Sprout className="h-5 w-5" />
              <h2 className="text-[18px] font-semibold">Soil &amp; crops</h2>
            </div>
            <div>
              <label htmlFor="soil" className={labelCls}>Soil type *</label>
              <input id="soil" className={inputCls} placeholder="e.g. black cotton (kali)"
                value={form.soil} onChange={(e) => set("soil", e.target.value)} />
            </div>
            <div>
              <label htmlFor="prev" className={labelCls}>Crops grown recently</label>
              <input id="prev" className={inputCls} placeholder="e.g. soybean, wheat"
                value={form.previousCrops} onChange={(e) => set("previousCrops", e.target.value)} />
            </div>
            <div>
              <label htmlFor="irrig" className={labelCls}>Irrigation setup</label>
              <input id="irrig" className={inputCls} placeholder="e.g. borewell + drip on 3 acres"
                value={form.irrigation} onChange={(e) => set("irrigation", e.target.value)} />
            </div>
            <label className="flex items-center gap-2.5 pt-6 text-[13.5px]">
              <input type="checkbox" checked={form.organic}
                onChange={(e) => set("organic", e.target.checked)}
                className="h-4 w-4 accent-[#1B6B47]" />
              Farmed organically (no chemical inputs)
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="max-w-2xl space-y-5">
            <h2 className="text-[18px] font-semibold">Documents &amp; contact</h2>
            <p className="text-[13.5px] muted">
              Tick what you have in hand — you don&rsquo;t upload anything here. Our field executive
              photographs documents during the visit, and each one shows on your parcel as{" "}
              <em>uploaded</em>, then <em>under review</em>, then <em>reviewed by FarmKaro</em>.
              Upload and verification are never the same thing.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["khasra", "Khasra (B-1)"],
                  ["khatauni", "Khatauni extract"],
                  ["ownership", "Ownership proof"],
                  ["identity", "Owner ID"],
                ] as const
              ).map(([k, label]) => (
                <label key={k}
                  className="surface flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px]">
                  <input type="checkbox" checked={form.docs[k]}
                    onChange={(e) => set("docs", { ...form.docs, [k]: e.target.checked })}
                    className="h-4 w-4 accent-[#1B6B47]" />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="oname" className={labelCls}>Your name *</label>
                <input id="oname" className={inputCls} value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)} />
              </div>
              <div>
                <label htmlFor="ophone" className={labelCls}>Phone (WhatsApp) *</label>
                <input id="ophone" type="tel" inputMode="tel" className={inputCls} placeholder="10-digit mobile"
                  value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} />
              </div>
            </div>
            <VerificationDisclaimer />
          </div>
        )}

        {/* Nav */}
        <div className="mt-7 flex items-center justify-between border-t hairline pt-5">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border hairline px-4 py-2 text-[13.5px] font-medium disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            {!canNext && (
              <span className="hidden items-center gap-1.5 text-[12px] muted sm:flex">
                <Info className="h-3.5 w-3.5" />
                {step === 1 ? "Place at least 3 corners to continue" : "Fill the required fields"}
              </span>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={() => setSubmitted(true)} disabled={!canNext}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-forest-700 disabled:opacity-40 dark:bg-forest-500">
                Review &amp; send <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
