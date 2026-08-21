import { NextResponse } from "next/server";
import { searchArchive } from "@/lib/demo-archive";
import { route } from "@/server/api";

/**
 * The synthetic demonstration archive. Openly fictional — which is exactly
 * why it needs no consent gate and allows free multi-field search: there is
 * no real person behind any row. The response says so on every call, so no
 * client can present these rows as records of real land.
 */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const result = searchArchive({
    q: url.searchParams.get("q") ?? undefined,
    tehsilCode: url.searchParams.get("tehsil") ?? undefined,
    village: url.searchParams.get("village") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1") || 1,
    pageSize: Number(url.searchParams.get("pageSize") ?? "20") || 20,
  });
  return NextResponse.json({
    ...result,
    synthetic: true,
    note:
      "Synthetic demonstration archive: every record, name and mortgage here " +
      "is fictional, generated to demonstrate district-scale search. Real " +
      "records resolve only via the consent-gated lookup.",
  });
});
