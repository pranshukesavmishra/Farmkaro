"use client";

/**
 * डेमो संग्रह — the synthetic archive browser.
 *
 * District-scale search over 15,000 openly fictional records. Name search is
 * allowed here precisely BECAUSE the rows are fiction; the panel says so and
 * explains why the real pilot records above work identifier-only. Every row
 * carries the synthetic badge — no row can be mistaken for a real person's
 * land.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Database, Loader2 } from "lucide-react";
import { TEHSILS } from "@/lib/district";
import type { ArchiveRecord } from "@/lib/demo-archive";
import { cn } from "@/lib/cn";

interface ArchiveResponse {
  rows: ArchiveRecord[];
  total: number;
  page: number;
  pageCount: number;
  note: string;
}

export function DemoArchivePanel() {
  const [q, setQ] = useState("");
  const [tehsil, setTehsil] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query: string, t: string, p: number) => {
    setBusy(true);
    try {
      const u = new URLSearchParams();
      if (query) u.set("q", query);
      if (t) u.set("tehsil", t);
      u.set("page", String(p));
      const res = await fetch(`/api/records/archive?${u}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* the panel simply keeps its previous state */
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load("", "", 1);
  }, [load]);

  function onQuery(next: string) {
    setQ(next);
    setPage(1);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(next, tehsil, 1), 300);
  }
  function onTehsil(next: string) {
    setTehsil(next);
    setPage(1);
    void load(q, next, 1);
  }
  function go(p: number) {
    setPage(p);
    void load(q, tehsil, p);
  }

  return (
    <section className="mt-20 border-t border-line pt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" aria-hidden /> डेमो संग्रह · Demonstration archive
          </p>
          <h2 className="display mt-2 text-xl">15,000 records, searchable</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            Every record here is <strong className="text-ink">synthetic</strong> — fictional
            owners, fictional mortgages — generated to demonstrate district-scale search. That is
            also why you can search it by name: nobody real is in it. Real records, like the pilot
            set above, resolve only by their own identifier with your recorded consent.
          </p>
        </div>
        {data && (
          <p className="readout text-xs text-ink-faint" aria-live="polite">
            {data.total.toLocaleString("en-IN")} of 15,000 match
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <input
          aria-label="Search the demonstration archive"
          className="field min-w-0 flex-1"
          placeholder="Khasra, khata, name, village or tehsil — e.g. 104, रमेश, Panagar"
          value={q}
          onChange={(e) => onQuery(e.target.value)}
        />
        <select
          aria-label="Tehsil filter"
          className="field w-full sm:w-56"
          value={tehsil}
          onChange={(e) => onTehsil(e.target.value)}
        >
          <option value="">All tehsils</option>
          {TEHSILS.map((t) => (
            <option key={t.code} value={t.code}>
              {t.nameHi} · {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card mt-4 overflow-hidden" aria-busy={busy}>
        {!data ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the archive…
          </p>
        ) : data.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            Nothing matches — try a shorter term.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.rows.map((r) => {
              const expanded = open === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : r.id)}
                    aria-expanded={expanded}
                    className="focus-ring flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="readout w-20 shrink-0 text-sm font-semibold">{r.khasraNumber}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{r.owner.nameHi}</span>
                      <span className="ml-2 text-xs text-ink-muted">
                        {r.villageHi} · {r.tehsilHi}
                      </span>
                    </span>
                    <span className="readout text-xs text-ink-muted">{r.areaAcres.toFixed(2)} ac</span>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
                      style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                    >
                      नमूना · synthetic
                    </span>
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 text-ink-faint transition-transform", expanded && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                  {expanded && (
                    <div className="grid gap-x-8 gap-y-2 border-t border-line bg-surface-2 px-5 py-4 text-sm sm:grid-cols-2">
                      <p><span className="eyebrow mr-2">Land ID</span><span className="readout text-xs">{r.landId}</span></p>
                      <p><span className="eyebrow mr-2">खाता</span><span className="readout text-xs">{r.khataNumber}</span> <span className="eyebrow ml-4 mr-2">हल्का</span><span className="readout text-xs">{r.halka}</span></p>
                      <p><span className="eyebrow mr-2">Owner</span>{r.owner.nameHi} ({r.owner.relationHi})</p>
                      <p><span className="eyebrow mr-2">Area</span><span className="readout text-xs">{r.areaHectares.toFixed(3)} ha · {r.areaAcres.toFixed(2)} ac · {r.areaBigha.toFixed(2)} बीघा</span></p>
                      <p><span className="eyebrow mr-2">मिट्टी</span>{r.soilHi} · {r.soil}</p>
                      <p><span className="eyebrow mr-2">सिंचाई</span>{r.irrigated ? r.waterSource : "असिंचित (rainfed)"}</p>
                      <p><span className="eyebrow mr-2">ख़रीफ़</span>{r.cropKharif}</p>
                      <p><span className="eyebrow mr-2">रबी</span>{r.cropRabi}</p>
                      <p className="sm:col-span-2">
                        <span className="eyebrow mr-2">बंधक</span>
                        {r.mortgage.isMortgaged
                          ? `${r.mortgage.lender} — ₹${(r.mortgage.amountINR ?? 0).toLocaleString("en-IN")}`
                          : "ऋण मुक्त (clean)"}
                      </p>
                      <p className="sm:col-span-2 text-xs leading-relaxed text-ink-muted">
                        चौहद्दी: उत्तर {r.boundaries.north} · दक्षिण {r.boundaries.south} · पूर्व{" "}
                        {r.boundaries.east} · पश्चिम {r.boundaries.west}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {data && data.pageCount > 1 && (
          <nav
            className="flex items-center justify-between border-t border-line px-5 py-3"
            aria-label="Archive pages"
          >
            <button
              type="button"
              onClick={() => go(page - 1)}
              disabled={page <= 1 || busy}
              className="btn btn-ghost px-3.5 py-1.5 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Prev
            </button>
            <p className="readout text-xs text-ink-muted">
              page {data.page} / {data.pageCount}
            </p>
            <button
              type="button"
              onClick={() => go(page + 1)}
              disabled={page >= data.pageCount || busy}
              className="btn btn-ghost px-3.5 py-1.5 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
