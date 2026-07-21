import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 * CSP notes:
 *  - img-src allows OSM/Esri map tiles and Earth Engine thumbnails.
 *  - style-src needs 'unsafe-inline' for Leaflet's inline positioning styles.
 *  - connect-src allows the Supabase REST endpoint (read-only anon key + RLS).
 */
// Next.js dev mode (Fast Refresh/HMR) wraps modules in eval(), which a
// strict script-src silently blocks — every client component (including
// dynamic imports like the map) then hangs forever with no console error.
// Production's webpack output doesn't need eval, so only dev gets it.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://earthengine.googleapis.com",
      `connect-src 'self' https://*.supabase.co${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
