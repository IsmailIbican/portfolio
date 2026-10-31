const FALLBACK = "http://localhost:3000";

let warned = false;

/**
 * Public address of the site (used for canonical links, the sitemap and social preview images).
 *
 * A wrong address here is silent damage: every canonical link and preview image would point somewhere else. So in
 * production a missing, invalid or non-https address is reported loudly in the server log (once), while the site keeps
 * working so that testing a production build on localhost is still possible.
 */
export function getSiteUrl(env: Record<string, string | undefined> = process.env): URL {
  const raw = env.NEXT_PUBLIC_SITE_URL;
  let url: URL | null = null;
  try {
    url = raw ? new URL(raw) : null;
  } catch {
    url = null;
  }

  if (env.NODE_ENV === "production" && !warned) {
    const local = url ? ["localhost", "127.0.0.1"].includes(url.hostname) : false;
    if (!url || (url.protocol !== "https:" && !local)) {
      warned = true;
      console.error(
        `site: NEXT_PUBLIC_SITE_URL is ${raw ? "not a valid https address" : "not set"}. Canonical links, the sitemap and preview images will point to ${FALLBACK}. Set it to the real https address.`,
      );
    }
  }

  return url ?? new URL(FALLBACK);
}

/** Test helper: lets a test observe the warning again. */
export function resetSiteUrlWarning() {
  warned = false;
}
