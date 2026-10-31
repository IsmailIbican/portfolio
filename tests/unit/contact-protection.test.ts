// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getEmailConfig, notifyNewMessage } from "@/features/contact/email";
import {
  createFormToken,
  getClientIp,
  hashIp,
  MAX_FORM_AGE_MS,
  MIN_FORM_AGE_MS,
  tokenHash,
  trustedProxyHops,
  verifyFormToken,
} from "@/features/contact/protection";
import { contactSchema } from "@/features/contact/schema";
import { getTurnstileConfig, verifyTurnstile } from "@/features/contact/turnstile";

const SECRET = "test-secret-with-enough-length-0123456789";
const T0 = 1_800_000_000_000;

describe("form token", () => {
  it("accepts a token after the minimum age and before it expires", () => {
    const token = createFormToken(SECRET, T0);
    expect(verifyFormToken(SECRET, token, T0 + MIN_FORM_AGE_MS)).toBe(true);
    expect(verifyFormToken(SECRET, token, T0 + MAX_FORM_AGE_MS)).toBe(true);
  });

  it("rejects a form submitted too fast, or too late", () => {
    const token = createFormToken(SECRET, T0);
    expect(verifyFormToken(SECRET, token, T0 + MIN_FORM_AGE_MS - 1)).toBe(false);
    expect(verifyFormToken(SECRET, token, T0 + MAX_FORM_AGE_MS + 1)).toBe(false);
  });

  it("gives every page view a different token", () => {
    expect(createFormToken(SECRET, T0)).not.toBe(createFormToken(SECRET, T0));
    expect(tokenHash(createFormToken(SECRET, T0))).not.toBe(tokenHash(createFormToken(SECRET, T0)));
  });

  it("rejects a token signed with another secret, or with a changed timestamp or nonce", () => {
    const foreign = createFormToken("another-secret-0123456789012345", T0);
    expect(verifyFormToken(SECRET, foreign, T0 + 10_000)).toBe(false);

    const [issuedAt, nonce, signature] = createFormToken(SECRET, T0).split(".");
    expect(verifyFormToken(SECRET, `${Number(issuedAt) - 100_000}.${nonce}.${signature}`, T0 + 10_000)).toBe(false);
    expect(verifyFormToken(SECRET, `${issuedAt}.${"A".repeat(16)}.${signature}`, T0 + 10_000)).toBe(false);
  });

  it("rejects missing, malformed and non-string tokens", () => {
    for (const bad of [undefined, null, 42, "", "abc", "123.", ".sig", "1800000000000.sig", "1800000000000.nonce.sig.extra", "notanumber.AAAAAAAAAAAAAAAA.sig"]) {
      expect(verifyFormToken(SECRET, bad, T0 + 10_000)).toBe(false);
    }
  });

  it("stores only a hash, which is stable for the same token", () => {
    const token = createFormToken(SECRET, T0);
    expect(tokenHash(token)).toBe(tokenHash(token));
    expect(tokenHash(token)).toHaveLength(64);
    expect(tokenHash(token)).not.toContain(token.slice(0, 12));
  });
});

describe("hashIp", () => {
  it("hashes deterministically without containing the address", () => {
    const hash = hashIp(SECRET, "203.0.113.7");
    expect(hash).toBe(hashIp(SECRET, "203.0.113.7"));
    expect(hash).not.toContain("203");
    expect(hash).toHaveLength(32);
    expect(hashIp(SECRET, "203.0.113.8")).not.toBe(hash);
    expect(hashIp("other-secret-0123456789012345678", "203.0.113.7")).not.toBe(hash);
  });
});

describe("client address and the trust model", () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it("trusts nothing when no proxy is configured, whatever the visitor sends", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.7" }), 0)).toBeNull();
    expect(getClientIp(headers({ "x-real-ip": "203.0.113.7" }), 0)).toBeNull();
  });

  it("with one trusted proxy, takes the rightmost entry (the one our proxy wrote)", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.7" }), 1)).toBe("203.0.113.7");
    // A visitor-supplied value sits on the left and is ignored.
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }), 1)).toBe("203.0.113.7");
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 203.0.113.7" }), 1)).toBe("203.0.113.7");
  });

  it("with two trusted proxies, takes the second from the right", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1" }), 2)).toBe("203.0.113.7");
  });

  it("returns null instead of guessing when the header is missing, too short or oversized", () => {
    expect(getClientIp(headers({}), 1)).toBeNull();
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.7" }), 2)).toBeNull();
    expect(getClientIp(headers({ "x-forwarded-for": "x".repeat(200) }), 1)).toBeNull();
  });

  it("defaults to one hop on Vercel, none elsewhere, and honours an explicit setting", () => {
    expect(trustedProxyHops({ VERCEL: "1" })).toBe(1);
    expect(trustedProxyHops({})).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "2" })).toBe(2);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "0", VERCEL: "1" })).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "abc", VERCEL: "1" })).toBe(1);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "" })).toBe(0);
  });
});

describe("contactSchema", () => {
  const valid = { name: "Ada", email: "Ada@Example.com ", message: "Hello there, a real message." };
  const bidiOverride = String.fromCodePoint(0x202e);
  const lineSeparator = String.fromCodePoint(0x2028);
  const zeroWidthNonJoiner = String.fromCodePoint(0x200c);

  it("accepts a normal message and normalises the email", () => {
    expect(contactSchema.parse(valid).email).toBe("ada@example.com");
  });

  it("rejects bad input", () => {
    expect(contactSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "short" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success).toBe(false);
  });

  it("rejects line breaks and control characters in the name", () => {
    expect(contactSchema.safeParse({ ...valid, name: "Ada\r\nBcc: attacker@example.com" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, name: "Ada\u0000" }).success).toBe(false);
  });

  it("rejects characters that can disguise a name: bidi overrides and line separators", () => {
    expect(contactSchema.safeParse({ ...valid, name: `Ada${bidiOverride}moc.live` }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, name: `Ada${lineSeparator}Eve` }).success).toBe(false);
  });

  it("still accepts names that legitimately use a zero-width non-joiner", () => {
    expect(contactSchema.safeParse({ ...valid, name: `می${zeroWidthNonJoiner}خواهم` }).success).toBe(true);
  });
});

describe("notifyNewMessage", () => {
  const message = { name: "Ada", email: "ada@example.com", message: "Hello there, a real message." };
  const config = { apiKey: "re_key", to: "me@example.com", from: "Portfolio <noreply@example.com>" };

  it("is skipped without configuration", async () => {
    const fetchImpl = vi.fn();
    expect(await notifyNewMessage(message, null, fetchImpl as unknown as typeof fetch)).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the expected request to Resend, with the visitor as reply-to and a fixed subject prefix", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await notifyNewMessage(message, config, fetchImpl as unknown as typeof fetch)).toBe("sent");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ to: ["me@example.com"], reply_to: "ada@example.com", from: config.from });
    expect(sent.subject).toBe("[Portfolio contact] Ada");
  });

  it("shortens a very long name in the subject", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await notifyNewMessage({ ...message, name: "N".repeat(100) }, config, fetchImpl as unknown as typeof fetch);
    const sent = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.subject).toBe(`[Portfolio contact] ${"N".repeat(60)}`);
  });

  it("reports failure without throwing for API errors and network errors", async () => {
    expect(await notifyNewMessage(message, config, vi.fn(async () => new Response("no", { status: 422 })) as unknown as typeof fetch)).toBe("failed");
    expect(await notifyNewMessage(message, config, vi.fn(async () => Promise.reject(new Error("down"))) as unknown as typeof fetch)).toBe("failed");
  });

  it("only turns on when all three settings exist", () => {
    expect(getEmailConfig({ EMAIL_PROVIDER_API_KEY: "k", CONTACT_TO_EMAIL: "a@b.co", EMAIL_FROM: "x@y.co" })).not.toBeNull();
    expect(getEmailConfig({ EMAIL_PROVIDER_API_KEY: "k", CONTACT_TO_EMAIL: "a@b.co" })).toBeNull();
    expect(getEmailConfig({})).toBeNull();
    expect(getEmailConfig({ EMAIL_PROVIDER_API_KEY: " ", CONTACT_TO_EMAIL: "a@b.co", EMAIL_FROM: "x@y.co" })).toBeNull();
  });
});

describe("Turnstile", () => {
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("is on only when both keys are set, so the widget and the server check agree", () => {
    expect(getTurnstileConfig({ TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" })).toEqual({ siteKey: "site", secret: "secret" });
    expect(getTurnstileConfig({ TURNSTILE_SECRET_KEY: "secret" })).toBeNull();
    expect(getTurnstileConfig({ TURNSTILE_SITE_KEY: "site" })).toBeNull();
    expect(getTurnstileConfig({ TURNSTILE_SITE_KEY: " ", TURNSTILE_SECRET_KEY: "secret" })).toBeNull();
    expect(getTurnstileConfig({})).toBeNull();
  });

  it("passes only when Cloudflare says success", async () => {
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: ok({ success: true }) as unknown as typeof fetch })).toBe(true);
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: ok({ success: false }) as unknown as typeof fetch })).toBe(false);
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: ok({ success: "true" }) as unknown as typeof fetch })).toBe(false);
  });

  it("fails closed on errors, outages and missing tokens", async () => {
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: ok({}, 500) as unknown as typeof fetch })).toBe(false);
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: vi.fn(async () => Promise.reject(new Error("down"))) as unknown as typeof fetch })).toBe(false);
    const never = vi.fn();
    expect(await verifyTurnstile(undefined, { secret: "s", fetchImpl: never as unknown as typeof fetch })).toBe(false);
    expect(await verifyTurnstile("", { secret: "s", fetchImpl: never as unknown as typeof fetch })).toBe(false);
    expect(never).not.toHaveBeenCalled();
  });

  it("sends the secret, the token and the visitor's address when known", async () => {
    const fetchImpl = ok({ success: true });
    await verifyTurnstile("tok", { secret: "s3cret", ip: "203.0.113.7", fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("secret")).toBe("s3cret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("leaves the address out when it is unknown", async () => {
    const fetchImpl = ok({ success: true });
    await verifyTurnstile("tok", { secret: "s", fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.has("remoteip")).toBe(false);
  });
});
