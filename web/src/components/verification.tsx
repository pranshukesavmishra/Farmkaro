import { Check, CircleDashed, Info } from "lucide-react";
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
 */
export function GeometryLadder({ status }: { status: GeometryStatus }) {
  const reached = GEOMETRY_LADDER.indexOf(status);
  return (
    <ol className="space-y-0">
      {GEOMETRY_LADDER.map((step, i) => {
        const done = i <= reached;
        return (
          <li key={step} className="flex items-start gap-3 py-2">
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                done
                  ? "border-forest-500 bg-forest-500 text-white"
                  : "border-[var(--line)] text-[var(--fg-muted)]",
              )}
            >
              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <CircleDashed className="h-3 w-3" />}
            </span>
            <span className={cn("text-[13.5px] leading-5", done ? "font-medium" : "muted")}>
              {GEOMETRY_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DocumentList({ docs }: { docs: DocumentRef[] }) {
  return (
    <ul className="divide-y divide-[var(--line)]">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <span className="text-[13.5px]">{d.label}</span>
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
    <p className={cn("flex gap-2 text-[12px] leading-[1.5] muted", className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        A FarmKaro review confirms that documents were submitted and inspected by our team. It is
        <strong className="font-semibold"> not a government verification of title</strong>, and it
        does not certify ownership. Please carry out your own due diligence before signing.
      </span>
    </p>
  );
}
