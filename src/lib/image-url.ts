import { getBlobPublicHost } from "@/lib/storage/blob-host";

const PLACEHOLDER_ORIGIN = "https://placeholder.invalid";

/**
 * True only for images next/image may load: our own upload route in development, or our Blob store in production.
 * Anything else (a link pasted into the admin form, a query string) would be refused by the image allow-lists and
 * the CSP, so callers skip it instead of rendering a broken image.
 */
export function isHostedImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return false;
  }
  if (url.search !== "") return false;

  if (value.startsWith("/")) {
    return url.origin === PLACEHOLDER_ORIGIN && url.pathname.startsWith("/uploads/");
  }
  const host = getBlobPublicHost();
  return host !== null && url.protocol === "https:" && url.hostname === host && url.pathname.startsWith("/images/");
}
