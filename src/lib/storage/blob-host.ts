// No "server-only" import: next.config.ts and the proxy both read the host from here.

/** Public hosts of a Vercel Blob store look like "<store-id>.public.blob.vercel-storage.com". */
const BLOB_PUBLIC_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

/**
 * The host uploaded files are served from in production, or null when none is configured (local development).
 * It feeds the image allow-lists (next/image and the CSP), so a malformed value is ignored instead of widening them.
 */
export function getBlobPublicHost(): string | null {
  const host = process.env.BLOB_PUBLIC_HOST?.trim().toLowerCase();
  return host && BLOB_PUBLIC_HOST.test(host) ? host : null;
}
