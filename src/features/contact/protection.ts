import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Name of the invisible trap field. Not a word browsers autofill (website, url, email, phone). */
export const HONEYPOT_FIELD = "contact_ref_2";

/** A form must stay open at least this long before it can be submitted: scripts post instantly, people do not. */
export const MIN_FORM_AGE_MS = 3_000;
/** ...and a token expires after this long. */
export const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;

const sign = (secret: string, context: string, value: string) =>
  createHmac("sha256", secret).update(`${context}:${value}`).digest("base64url");

/**
 * Signed, random, timestamped token embedded in the page. Cannot be forged without the server secret, and each
 * token can be spent only once (see tokenHash): the message that uses it stores the hash under a unique index.
 */
export function createFormToken(secret: string, now = Date.now()): string {
  const body = `${now}.${randomBytes(12).toString("base64url")}`;
  return `${body}.${sign(secret, "contact-form", body)}`;
}

export function verifyFormToken(secret: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== "string") return false;
  const [issuedAt, nonce, signature, ...rest] = token.split(".");
  if (!issuedAt || !nonce || !signature || rest.length > 0 || !/^\d{10,15}$/.test(issuedAt) || !/^[\w-]{16}$/.test(nonce)) return false;

  const expected = Buffer.from(sign(secret, "contact-form", `${issuedAt}.${nonce}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

  const age = now - Number(issuedAt);
  return age >= MIN_FORM_AGE_MS && age <= MAX_FORM_AGE_MS;
}

/** What is stored to remember a token was spent. The token itself is never kept. */
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Salted one-way hash, so rate limiting works without ever storing an IP address. */
export function hashIp(secret: string, ip: string): string {
  return createHmac("sha256", secret).update(`contact-ip:${ip}`).digest("hex").slice(0, 32);
}

/**
 * How many reverse proxies sit in front of the app and append to x-forwarded-for.
 * Vercel (VERCEL is set there) is one hop. Anywhere else the default is 0: no header is trusted, because a visitor
 * can send any x-forwarded-for they like. Set TRUSTED_PROXY_HOPS when you run behind your own proxy.
 */
export function trustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS;
  if (raw !== undefined && /^\d{1,2}$/.test(raw)) return Number(raw);
  return env.VERCEL ? 1 : 0;
}

/**
 * The visitor's address as seen by our own proxy: the entry `hops` places from the RIGHT of x-forwarded-for, because
 * every proxy appends to the right and only the rightmost entries are written by infrastructure we trust.
 * Returns null when no header can be trusted; callers then skip per-visitor limits instead of pooling everyone.
 */
export function getClientIp(headers: Pick<Headers, "get">, hops: number): string | null {
  if (hops < 1) return null;
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const ip = entries[entries.length - hops];
  return ip && ip.length <= 64 ? ip : null;
}
