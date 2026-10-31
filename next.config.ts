import type { NextConfig } from "next";
import { getBlobPublicHost } from "./src/lib/storage/blob-host";

const blobHost = getBlobPublicHost();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Production only: browsers ignore HSTS on plain http anyway, and it must not be sent while testing on localhost.
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
}

// The Content-Security-Policy is set per request in src/proxy.ts, because it carries a fresh nonce each time.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Always send <title> and the description/social tags inside <head> in the first response, instead of streaming them
  // after the page for ordinary browsers. A search engine or link preview that does not run JavaScript then still sees them.
  // The cost is a few milliseconds: the metadata queries finish before the HTML starts.
  htmlLimitedBots: /.*/,
  // `experimental.inlineCss` was tried and rejected: the <style> tags it generates carry no CSP nonce, so the strict
  // policy blocks them and the page renders unstyled. Revisit only if Next adds nonces to inlined CSS.
  images: {
    // Uploaded files are served from our own /uploads route (local dev) or from the Blob store (production): one exact
    // host, images only, no wildcard. `search: ""` forbids query strings, so nobody can mint unlimited optimizer
    // cache entries with ?x=1, ?x=2...
    localPatterns: [{ pathname: "/uploads/**", search: "" }],
    remotePatterns: blobHost ? [{ protocol: "https", hostname: blobHost, pathname: "/images/**", search: "" }] : [],
    qualities: [75],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
