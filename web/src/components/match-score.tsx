import { MATCH_LABELS } from "@/lib/match";
import type { MatchBreakdown } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * A match score is never shown without the reasoning that produced it.
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
          "inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/12 px-2.5 py-1",
          className,
        )}
        title={Object.entries(breakdown)
          .map(([k, v]) => `${MATCH_LABELS[k as keyof MatchBreakdown]} ${v}`)
          .join(" · ")}
      >
        <span className="font-mono text-[12px] font-semibold tabular-nums text-[#8a6b22] dark:text-gold">
          {score}%
        </span>
        <span className="text-[11px] font-medium text-[#8a6b22] dark:text-gold">match</span>
      </span>
    );
  }

  return (
    <div className={cn("surface rounded-xl border p-4", className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] muted">Match for your search</p>
        <p className="font-mono text-[26px] font-semibold tabular-nums leading-none text-[#8a6b22] dark:text-gold">
          {score}%
        </p>
      </div>
      <dl className="mt-4 space-y-2.5">
        {(Object.keys(breakdown) as (keyof MatchBreakdown)[]).map((k) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr_2.2rem] items-center gap-3">
            <dt className="text-[12.5px] muted">{MATCH_LABELS[k]}</dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-forest-500 dark:bg-forest-300"
                style={{ width: `${breakdown[k]}%` }}
              />
            </dd>
            <dd className="text-right font-mono text-[12px] tabular-nums muted">{breakdown[k]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3.5 text-[11.5px] leading-[1.5] muted">
        Weighted from what you searched for. Every component is a plain rule you can inspect — no
        hidden model.
      </p>
    </div>
  );
}
