import { MATCH_LABELS } from "@/lib/match";
import type { MatchBreakdown } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * A match score is never shown without the reasoning that produced it.
 *
 * Compact, it is a gold readout chip that sits on satellite imagery: an opaque
 * surface behind it so the figure stays legible over any photograph, in either
 * theme. Full, it opens into the weighted components as labelled bars.
 */
export function MatchScore({
  score,
  breakdown,
  compact = false,
  className,
}: {
  score: number;
  breakdown: MatchBreakdown;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm backdrop-blur-md",
          "border-[color-mix(in_srgb,var(--gold)_50%,transparent)]",
          "bg-[color-mix(in_srgb,var(--surface)_88%,transparent)]",
          className,
        )}
        title={Object.entries(breakdown)
          .map(([k, v]) => `${MATCH_LABELS[k as keyof MatchBreakdown]} ${v}`)
          .join(" · ")}
      >
        <span className="readout text-xs font-semibold leading-none text-gold">{score}%</span>
        <span className="font-mono text-[10px] uppercase leading-none tracking-[0.14em] text-ink-faint">
          match
        </span>
      </span>
    );
  }

  return (
    <div className={cn("card p-5", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">Match for your search</p>
        <p className="readout text-lg font-semibold leading-none text-gold">{score}%</p>
      </div>

      <dl className="mt-5 space-y-3">
        {(Object.keys(breakdown) as (keyof MatchBreakdown)[]).map((k) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr_2.2rem] items-center gap-3">
            <dt className="text-xs text-ink-muted">{MATCH_LABELS[k]}</dt>
            <dd className="relative h-[3px] overflow-hidden rounded-full bg-line">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-brand"
                style={{ width: `${breakdown[k]}%` }}
              />
            </dd>
            <dd className="readout text-right text-xs text-ink-faint">{breakdown[k]}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-line pt-3.5 text-xs leading-relaxed text-ink-muted">
        Weighted from what you searched for. Every component is a plain rule you can inspect — no
        hidden model.
      </p>
    </div>
  );
}
