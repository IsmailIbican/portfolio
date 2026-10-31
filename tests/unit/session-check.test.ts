import { describe, expect, it } from "vitest";
import { isSessionValid, SESSION_MAX_AGE_MS } from "@/features/auth/session-check";

const now = 1_000_000_000_000;
const valid = { tokenVersion: 3, loginAt: now - 1000, dbVersion: 3, role: "ADMIN", now };

describe("isSessionValid", () => {
  it("accepts a fresh session with a matching version", () => {
    expect(isSessionValid(valid)).toBe(true);
  });

  it("rejects a session revoked by a version bump", () => {
    expect(isSessionValid({ ...valid, dbVersion: 4 })).toBe(false);
  });

  it("rejects a token without a version", () => {
    expect(isSessionValid({ ...valid, tokenVersion: undefined })).toBe(false);
  });

  it("rejects a session older than the absolute lifetime", () => {
    expect(isSessionValid({ ...valid, loginAt: now - SESSION_MAX_AGE_MS - 1 })).toBe(false);
  });

  it("rejects a token without a login time", () => {
    expect(isSessionValid({ ...valid, loginAt: undefined })).toBe(false);
  });

  it("rejects non-admin roles", () => {
    expect(isSessionValid({ ...valid, role: "EDITOR" })).toBe(false);
  });
});
