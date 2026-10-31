const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile is on only when BOTH keys exist, so the page (widget) and the server (check) can never disagree. */
export function getTurnstileConfig(env: Record<string, string | undefined> = process.env): { siteKey: string; secret: string } | null {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secret ? { siteKey, secret } : null;
}

/**
 * Checks a Cloudflare Turnstile token on the server. Any failure (network, timeout, bad answer) counts as "not human",
 * so an outage cannot be used to skip the check.
 */
export async function verifyTurnstile(
  token: unknown,
  options: { secret: string; ip?: string; fetchImpl?: typeof fetch },
): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret: options.secret, response: token });
  if (options.ip && options.ip !== "unknown") body.set("remoteip", options.ip);

  try {
    const response = await (options.fetchImpl ?? fetch)(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
