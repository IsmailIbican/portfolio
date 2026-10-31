import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

// Next compiles the matcher with path-to-regexp; the lookahead inside it behaves like a plain regular expression.
const entry = config.matcher[0];
if (!entry) throw new Error("The proxy has no matcher.");
const source = typeof entry === "string" ? entry : entry.source;
const matches = (path: string) => new RegExp(`^${source}$`).test(path);

describe("proxy matcher (which requests get the CSP)", () => {
  it("covers every page, including admin pages and pages whose name merely starts like an excluded folder", () => {
    for (const path of ["/", "/projects", "/projects/some-slug", "/about", "/contact", "/admin", "/admin/login", "/admin/projects/abc", "/api-docs", "/apiary", "/uploads-guide"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("skips API routes, build assets, optimized images, uploaded files and the favicon", () => {
    for (const path of ["/api/auth/session", "/api/admin/media", "/_next/static/chunks/a.js", "/_next/image", "/uploads/images/x.png", "/favicon.ico"]) {
      expect(matches(path), path).toBe(false);
    }
  });
});
