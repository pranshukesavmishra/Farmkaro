import { cn } from "@/lib/cn";

/**
 * Shared primitives, in the Field Survey language: quiet chrome, hairline
 * rules, and every measured value set as an instrument readout.
 */

/**
 * A status pill. Deliberately small and quiet — a badge annotates a fact, it
 * never competes with the imagery or the readout beside it.
 */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "pending" | "muted" | "gold";
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-surface-2 text-ink-muted",
    good: "border-[color-mix(in_srgb,var(--positive)_34%,transparent)] bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] text-positive",
    pending: "border-[color-mix(in_srgb,var(--gold)_36%,transparent)] bg-gold-soft text-gold",
    muted: "border-line bg-transparent text-ink-faint",
    gold: "border-[color-mix(in_srgb,var(--gold)_45%,transparent)] bg-gold-soft text-gold",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px]",
        "text-xs font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-16 sm:py-20", className)}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-xl">{title}</h2>
          {description && (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A single figure, presented the way an instrument presents one: a mono
 * uppercase label, the value in tabular figures, and the caveat on a hairline
 * below it.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent" | "warn";
}) {
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "readout mt-3 text-lg font-semibold leading-none",
          tone === "accent" && "text-brand",
          tone === "warn" && "text-gold",
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
          {sub}
        </p>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-surface-2",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r",
        "after:from-transparent after:via-[color-mix(in_srgb,var(--fg)_9%,transparent)] after:to-transparent",
        className,
      )}
    />
  );
}

/**
 * Nothing found — stated calmly, on survey paper, with the next move offered
 * rather than an apology.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card ticks grid-paper flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <span className="mb-5 grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-ink-faint">
          {icon}
        </span>
      )}
      <h3 className="display text-lg">{title}</h3>
      <p className="mt-2.5 max-w-[44ch] text-sm leading-relaxed text-ink-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
