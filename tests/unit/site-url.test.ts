import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, resetSiteUrlWarning } from "@/lib/site";

describe("getSiteUrl", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    resetSiteUrlWarning();
    error.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the configured public address", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://me.example" }).origin).toBe("https://me.example");
  });

  it("falls back to localhost when nothing is configured or the value is invalid", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "" }).origin).toBe("http://localhost:3000");
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "not a url" }).origin).toBe("http://localhost:3000");
  });

  it("stays quiet outside production", () => {
    getSiteUrl({ NEXT_PUBLIC_SITE_URL: "" });
    getSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://example.com", NODE_ENV: "development" });
    expect(error).not.toHaveBeenCalled();
  });

  it("warns loudly in production when the address is missing, invalid or not https", () => {
    for (const value of [undefined, "not a url", "http://example.com"]) {
      resetSiteUrlWarning();
      error.mockClear();
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: value, NODE_ENV: "production" });
      expect(error).toHaveBeenCalledTimes(1);
    }
  });

  it("warns only once, so the log is not flooded on every request", () => {
    getSiteUrl({ NODE_ENV: "production" });
    getSiteUrl({ NODE_ENV: "production" });
    getSiteUrl({ NODE_ENV: "production" });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("does not warn for a correct https address, nor for localhost (testing a production build locally)", () => {
    getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://me.example", NODE_ENV: "production" });
    getSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NODE_ENV: "production" });
    expect(error).not.toHaveBeenCalled();
  });
});
