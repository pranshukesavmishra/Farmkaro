import { cn } from "@/lib/cn";

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
    neutral: "bg-[var(--surface)] text-[var(--fg-muted)] border-[var(--line)]",
    good: "bg-forest-500/12 text-forest-500 border-forest-500/25 dark:text-forest-300",
    pending: "bg-gold/12 text-[#8a6b22] border-gold/30 dark:text-gold",
    muted: "bg-[var(--surface)] text-[var(--fg-muted)] border-[var(--line)] opacity-80",
    gold: "bg-gold/14 text-[#8a6b22] border-gold/35 dark:text-gold",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium leading-none",
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
    <section className={cn("py-10 sm:py-14", className)}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">{title}</h2>
          {description && <p className="mt-1.5 max-w-[62ch] text-[14.5px] muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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
    <div className="surface rounded-xl border p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.09em] muted">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-[24px] font-semibold tabular-nums leading-none tracking-tight",
          tone === "accent" && "text-forest-500 dark:text-forest-300",
          tone === "warn" && "text-gold",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12.5px] muted">{sub}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-[var(--line)]/60",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent",
        className,
      )}
    />
  );
}

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
    <div className="surface flex flex-col items-center gap-3 rounded-xl border px-6 py-14 text-center">
      {icon && <div className="text-[var(--fg-muted)]">{icon}</div>}
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="max-w-[42ch] text-[14px] muted">{body}</p>
      {action}
    </div>
  );
}
