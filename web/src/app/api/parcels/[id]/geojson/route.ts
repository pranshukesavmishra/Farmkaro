import { NextResponse } from "next/server";
import { route } from "@/server/api";
import { parcelView } from "@/server/services";

/** Public GeoJSON export of a parcel boundary - documents stay private,
 *  geometry of an active listing is public information. */
export const GET = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  const p = parcelView(id);
  if (!p) return NextResponse.json({ error: "Parcel not found." }, { status: 404 });
  return NextResponse.json({
    type: "Feature",
    properties: {
      ref: p.ref,
      village: p.village,
      district: p.district,
      area_acres: p.areaAcres,
      boundary_source: p.boundarySource,
      geometry_status: p.geometryStatus,
    },
    geometry: { type: "Polygon", coordinates: p.geometry },
  });
});
