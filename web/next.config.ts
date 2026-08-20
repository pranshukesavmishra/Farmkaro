import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 produces a fully static build (GitHub Pages / any static
 * host): the discovery search runs in the browser against the sample
 * repository and every parcel page is prerendered. The default (server) mode
 * is what a PostGIS-backed deployment uses.
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  ...(isExport
    ? { output: "export" as const, basePath, trailingSlash: true, images: { unoptimized: true } }
    : {
        images: {
          remotePatterns: [
            { protocol: "https", hostname: "server.arcgisonline.com" },
            { protocol: "https", hostname: "services.arcgisonline.com" },
          ],
        },
      }),
};

export default config;
