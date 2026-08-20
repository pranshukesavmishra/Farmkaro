import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parcel = await getRepository().byId(id);
  if (!parcel) return NextResponse.json({ error: "Parcel not found" }, { status: 404 });

  /**
   * Documents are deliberately reduced to status only. Private documents are
   * never reachable by changing an id in a URL — that is the exact IDOR the
   * security rules forbid. Access happens through a signed, short-lived URL
   * issued only to the owner, an ops reviewer, or a counterparty on an
   * accepted offer.
   */
  const safe = {
    ...parcel,
    documents: parcel.documents.map(({ id, docType, label, status, uploadedAt, reviewedAt }) => ({
      id,
      docType,
      label,
      status,
      uploadedAt,
      reviewedAt,
    })),
  };
  return NextResponse.json(safe);
}
