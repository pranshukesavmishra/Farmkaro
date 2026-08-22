import { Info } from "lucide-react";
import { dataSource } from "@/lib/repo";
import { DATA_NOTICE } from "@/lib/seed";

/**
 * Honesty rule: sample data is allowed only while it is unmistakably marked
 * as sample. This banner is not decoration — it is the thing that stops the
 * site becoming demo-ware wearing a product's clothes.
 *
 * It reads as a survey stamp above the masthead: quiet chrome, a gold marker
 * word, the notice itself in plain type.
 */
export function SampleDataBanner() {
  if (dataSource !== "sample") return null;
  return (
    <div className="border-b border-line bg-canvas-2">
      <div className="mx-auto flex max-w-shell items-center justify-center gap-2.5 px-4 py-2 text-center sm:px-6">
        <Info className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
        <p className="text-xs leading-snug text-ink-muted">
          <strong
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--gold)" }}
          >
            Sample data.
          </strong>{" "}
          {DATA_NOTICE}
        </p>
      </div>
    </div>
  );
}
