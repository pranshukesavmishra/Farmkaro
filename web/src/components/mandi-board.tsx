import { TrendingDown, TrendingUp } from "lucide-react";
import { MANDI_RATES, MANDI_RATES_AS_OF } from "@/lib/district";
import { cn } from "@/lib/cn";

/**
 * मंडी भाव — the Jabalpur mandi price board.
 *
 * An indicative board from the Lease Desk, stamped with its as-of date and
 * labelled as such: it informs a rent negotiation, it is not a live ticker.
 * The MSP column is the government's published support price, so a reader
 * can see at a glance where the market sits against the floor.
 */
export function MandiBoard({ className }: { className?: string }) {
  const asOf = new Date(MANDI_RATES_AS_OF).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section className={className}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="eyebrow">मंडी भाव · Jabalpur mandis</p>
          <h2 className="display mt-2 text-xl">Crop prices</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            Indicative board from the Lease Desk — a negotiation reference, not a live market feed.
          </p>
        </div>
        <p className="readout text-xs text-ink-faint">as of {asOf} · ₹/quintal</p>
      </div>

      <div className="card overflow-hidden">
        <div
          className="thin-scroll focus-ring overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Mandi prices"
        >
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {["Crop", "Mandi", "Range", "Modal", "MSP", "Day"].map((h) => (
                  <th key={h} scope="col" className="eyebrow px-5 py-3.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {MANDI_RATES.map((r) => {
                const aboveMsp = r.msp !== null && r.modal >= r.msp;
                return (
                  <tr key={r.crop} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-4">
                      <p className="font-semibold">
                        {r.cropHi} <span className="font-normal text-ink-muted">· {r.crop}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">{r.varieties}</p>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">{r.mandi}</td>
                    <td className="readout whitespace-nowrap px-5 py-4 text-xs text-ink-muted">
                      {r.min.toLocaleString("en-IN")}–{r.max.toLocaleString("en-IN")}
                    </td>
                    <td className="readout whitespace-nowrap px-5 py-4 font-semibold">
                      ₹{r.modal.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {r.msp === null ? (
                        <span className="text-xs text-ink-faint">market-driven</span>
                      ) : (
                        <span
                          className={cn("readout text-xs", aboveMsp ? "text-ink-muted" : "text-gold")}
                          title={aboveMsp ? "Modal price at or above MSP" : "Modal price below MSP"}
                        >
                          ₹{r.msp.toLocaleString("en-IN")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={cn(
                          "readout inline-flex items-center gap-1 text-xs font-semibold",
                          r.trend >= 0 ? "text-positive" : "text-danger",
                        )}
                      >
                        {r.trend >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {r.trend >= 0 ? "+" : "−"}₹{Math.abs(r.trend)}
                        <span className="sr-only"> per quintal, day-on-day change on the board date</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
