import type { NextConfig } from "next";

/**
 * The dashboard ships as a static export (./out) that the Worker serves as
 * static assets: free, and no server to run. Static export can't use rewrites,
 * so `next dev` alone proxies the API to `wrangler dev` on :8787.
 * Security headers live in public/_headers (static assets honour that file).
 */
const isBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isBuild
    ? { output: "export" as const, images: { unoptimized: true } }
    : {
        async rewrites() {
          return ["/api/:path*", "/media/:path*", "/webhook", "/health"].map((source) => ({
            source,
            destination: `${process.env.API_ORIGIN ?? "http://127.0.0.1:8787"}${source}`,
          }));
        },
      }),
};

export default nextConfig;
