import type { NextConfig } from "next";

/**
 * CORS configuration for LoreEngine / MythLoreBuilder.
 *
 * Rainstorms (and any future tool) runs on a different origin.
 * Without these headers every cross-origin browser request to /api/* is blocked.
 *
 * The wildcard origin is suitable for the MVP.  To restrict in production,
 * replace '*' with the exact Rainstorms origin, e.g.:
 *   'https://rainstorms.app'
 *
 * Multiple allowed origins can be handled per-route by reading the incoming
 * Origin header and reflecting it back if it is in an allow-list.
 */
const CORS_HEADERS = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
  {
    key: "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization, X-Requested-With",
  },
  { key: "Access-Control-Max-Age", value: "86400" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply CORS headers to all LoreEngine API routes so cross-origin
        // clients (Rainstorms, SagaArchitect, etc.) can call them from the browser.
        source: "/api/:path*",
        headers: CORS_HEADERS,
      },
    ];
  },
};

export default nextConfig;
