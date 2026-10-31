const TURNSTILE = "https://challenges.cloudflare.com";

export interface CspOptions {
  nonce: string;
  /** Development needs eval (React's debugging), websockets (hot reload) and inline styles injected by the dev server. */
  development?: boolean;
  /** Only add upgrade-insecure-requests when the page itself was served over https (it would break http://localhost). */
  https?: boolean;
  /** Extra image hosts, e.g. the Blob storage host in production. Exact origins only, no wildcards. */
  imageHosts?: string[];
}

/**
 * Content-Security-Policy with a per-request nonce ("strict CSP"):
 * - scripts run only if they carry the nonce, or were loaded by a script that does ('strict-dynamic');
 * - nothing can be embedded in a frame except Cloudflare's Turnstile challenge, and the site itself cannot be framed;
 * - style attributes are allowed because next/image positions images with them; they cannot run script;
 * - forms can only post back to this site.
 */
export function buildCsp({ nonce, development = false, https = false, imageHosts = [] }: CspOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])],
    // In development the dev server injects styles without a nonce, and a nonce would make browsers ignore 'unsafe-inline'.
    "style-src": development ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", ...imageHosts],
    "font-src": ["'self'"],
    "connect-src": ["'self'", TURNSTILE, ...(development ? ["ws:", "wss:"] : [])],
    "frame-src": [TURNSTILE],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
  return https ? `${policy}; upgrade-insecure-requests` : policy;
}

/** A fresh, unguessable value for every request. */
export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
