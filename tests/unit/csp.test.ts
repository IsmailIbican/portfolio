import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/csp";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ") ?? [];

describe("buildCsp (production)", () => {
  const policy = buildCsp({ nonce: "abc123" });

  it("allows scripts only with the nonce, and never unsafe-inline or eval", () => {
    const scripts = directive(policy, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("uses the nonce for style elements, and allows only style attributes inline", () => {
    expect(directive(policy, "style-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(directive(policy, "style-src-attr")).toEqual(["'unsafe-inline'"]);
  });

  it("forbids plugins, framing of the site, foreign base URLs and foreign form targets", () => {
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
  });

  it("lets Cloudflare Turnstile load and frame, and nothing else cross-origin", () => {
    expect(directive(policy, "frame-src")).toEqual(["https://challenges.cloudflare.com"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'", "https://challenges.cloudflare.com"]);
    expect(policy).not.toMatch(/\*/);
  });

  it("does not upgrade requests unless the page was served over https", () => {
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(buildCsp({ nonce: "n", https: true })).toContain("upgrade-insecure-requests");
  });

  it("adds extra image hosts only when asked", () => {
    expect(directive(policy, "img-src")).not.toContain("https://files.example.com");
    expect(directive(buildCsp({ nonce: "n", imageHosts: ["https://files.example.com"] }), "img-src")).toContain("https://files.example.com");
  });
});

describe("buildCsp (development)", () => {
  const policy = buildCsp({ nonce: "abc123", development: true });

  it("allows eval and websockets for hot reload, and inline styles without a nonce", () => {
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).toContain("ws:");
    expect(directive(policy, "style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });
});

describe("createNonce", () => {
  it("is different every time and safe to put in a header", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
