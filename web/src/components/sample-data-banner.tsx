import { Info } from "lucide-react";
import { dataSource } from "@/lib/repo";
import { DATA_NOTICE } from "@/lib/seed";

/**
 * Honesty rule: sample data is allowed only while it is unmistakably marked
 * as sample. This banner is not decoration — it is the thing that stops the
 * site becoming demo-ware wearing a product's clothes.
 */
export function SampleDataBanner() {
  if (dataSource !== "sample") return null;
  return (
    <div className="bg-forest-900 px-4 py-1.5 text-center text-[12px] leading-snug text-forest-100">
      <span className="inline-flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Sample data.</strong> {DATA_NOTICE}
        </span>
      </span>
    </div>
  );
}
