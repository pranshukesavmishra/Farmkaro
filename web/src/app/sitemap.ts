import type { MetadataRoute } from "next";

/** The pages Google should know about, in priority order. Parcel detail
 *  pages are pilot sample data and deliberately stay out until real
 *  listings replace them. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://farmkaro.in";
  const routes: Array<[path: string, priority: number]> = [
    ["/", 1],
    ["/discover", 0.9],
    ["/list-land", 0.9],
    ["/records", 0.8],
    ["/about", 0.8],
    ["/dashboard/owner", 0.5],
    ["/dashboard/farmer", 0.5],
  ];
  return routes.map(([path, priority]) => ({
    url: `${base}${path === "/" ? "" : path}/`,
    changeFrequency: "weekly",
    priority,
  }));
}

export const dynamic = "force-static";
