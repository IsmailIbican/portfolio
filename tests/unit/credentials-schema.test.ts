import { describe, expect, it } from "vitest";
import { credentialsSchema } from "@/features/auth/schema";

describe("credentialsSchema", () => {
  it("trims and lowercases the email", () => {
    const parsed = credentialsSchema.parse({ email: "  Admin@Example.COM ", password: "x" });
    expect(parsed.email).toBe("admin@example.com");
  });

  it("rejects an invalid email", () => {
    expect(credentialsSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(credentialsSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });

  it("rejects oversized passwords", () => {
    expect(credentialsSchema.safeParse({ email: "a@example.com", password: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(credentialsSchema.safeParse({}).success).toBe(false);
  });
});
