// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron-auth";

const SECRET = "s3cret-value-for-tests-0123456789abcdef";

describe("isCronAuthorized", () => {
  it("accepts the exact bearer token", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuses a missing header, a wrong token, a prefix of the token and a different scheme", () => {
    expect(isCronAuthorized(null, SECRET)).toBe(false);
    expect(isCronAuthorized("Bearer wrong", SECRET)).toBe(false);
    expect(isCronAuthorized(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false);
    expect(isCronAuthorized(`Basic ${SECRET}`, SECRET)).toBe(false);
    expect(isCronAuthorized(SECRET, SECRET)).toBe(false);
  });

  it("refuses everything when no secret is configured, even an empty bearer token", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized(null, undefined)).toBe(false);
  });
});
