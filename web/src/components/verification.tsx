import { Info } from "lucide-react";
import { Badge } from "./ui";
import {
  DOCUMENT_LABEL,
  GEOMETRY_LABEL,
  GEOMETRY_LADDER,
  IDENTITY_LABEL,
  type DocumentRef,
  type GeometryStatus,
  type IdentityStatus,
} from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * The verification ladder.
 *
 * Replaces a binary "Verified ✓" with the specific rung actually reached.
 * The disclaimer below is not boilerplate — separating "reviewed by FarmKaro"
 * from "verified by government" is a non-negotiable product rule.
 *
 * Drawn as a survey ladder: a hairline riser, numbered rungs, a filled node
 * for every rung reached and a hollow one for those still ahead. Shape — not
 * colour alone — carries the state.
 */
export function GeometryLadder({ status }: { status: GeometryStatus }) {
  const reached = GEOMETRY_LADDER.indexOf(status);
  const last = GEOMETRY_LADDER.length - 1;

  return (
    <ol className="relative">
      {GEOMETRY_LADDER.map((step, i) => {
        const done = i <= reached;
        const current = i === reached;
        return (
          <li
            key={step}
            aria-current={current ? "step" : undefined}
            className={cn("relative flex items-start gap-3.5", i < last ? "pb-4" : "pb-0")}
          >
            {/* Riser: solid up to the rung reached, hairline beyond it. */}
            {i < last && (
              <span
                aria-hidden
                className="absolute left-[5px] top-3 w-px"
                style={{
                  bottom: 0,
                  background: i < reached ? "var(--brand)" : "var(--line-strong)",
                  opacity: i < reached ? 0.75 : 1,
                }}
              />
            )}

            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-[7px] h-[11px] w-[11px] shrink-0 rounded-full border",
                done ? "border-brand bg-brand" : "border-line-strong bg-surface",
              )}
              style={
                current
                  ? { boxShadow: "0 0 0 3.5px color-mix(in srgb, var(--brand) 22%, transparent)" }
                  : undefined
              }
            />

            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <span
                className={cn(
                  "text-sm leading-snug",
                  done ? "font-medium text-ink" : "text-ink-faint",
                )}
              >
                {GEOMETRY_LABEL[step]}
                <span className="sr-only">{done ? " — reached" : " — not reached"}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "readout ml-auto shrink-0 text-xs",
                  done ? "text-ink-faint" : "text-ink-faint opacity-55",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Documents as a hairline table: the paper on the left, its true state on the right. */
export function DocumentList({ docs }: { docs: DocumentRef[] }) {
  return (
    <ul className="divide-y divide-line">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <span className="text-sm text-ink">{d.label}</span>
          <Badge
            tone={
              d.status === "reviewed_by_farmkaro"
                ? "good"
                : d.status === "under_review"
                  ? "pending"
                  : d.status === "uploaded"
                    ? "neutral"
                    : "muted"
            }
          >
            {DOCUMENT_LABEL[d.status]}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function IdentityBadge({ status }: { status: IdentityStatus }) {
  return (
    <Badge tone={status === "id_checked_by_farmkaro" ? "good" : status === "id_submitted" ? "pending" : "muted"}>
      {IDENTITY_LABEL[status]}
    </Badge>
  );
}

export function VerificationDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex gap-2.5 text-xs leading-relaxed text-ink-muted", className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
      <span>
        A FarmKaro review confirms that documents were submitted and inspected by our team. It is
        <strong className="font-semibold text-ink"> not a government verification of title</strong>, and it
        does not certify ownership. Please carry out your own due diligence before signing.
      </span>
    </p>
  );
}
