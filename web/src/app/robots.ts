import type { MetadataRoute } from "next";

/** Everything public is crawlable; the sitemap lives on the production
 *  domain so every mirror points Google at the same index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://farmkaro.in/sitemap.xml",
  };
}

export const dynamic = "force-static";
