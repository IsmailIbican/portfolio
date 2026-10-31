import { describe, expect, it } from "vitest";
import { educationSchema } from "@/features/education/schema";
import { experienceSchema } from "@/features/experience/schema";
import { profileFormSchema } from "@/features/profile/schema";
import { technologySchema } from "@/features/technologies/schema";

describe("profileFormSchema", () => {
  it("turns empty strings into null and splits profile from settings", () => {
    const parsed = profileFormSchema.parse({ fullName: " Someone ", headline: "", siteTitle: "T" });
    expect(parsed.profile.fullName).toBe("Someone");
    expect(parsed.profile.headline).toBeNull();
    expect(parsed.settings.siteTitle).toBe("T");
  });

  it("rejects non-http URLs (javascript: links)", () => {
    expect(profileFormSchema.safeParse({ linkedinUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ websiteUrl: "https://example.com" }).success).toBe(true);
  });

  it("allows a site path for the CV but not a protocol-relative one", () => {
    expect(profileFormSchema.safeParse({ cvUrl: "/uploads/cv.pdf" }).success).toBe(true);
    expect(profileFormSchema.safeParse({ cvUrl: "//evil.example/cv.pdf" }).success).toBe(false);
  });

  it("validates the GitHub username and email", () => {
    expect(profileFormSchema.safeParse({ githubUsername: "octo-cat" }).success).toBe(true);
    expect(profileFormSchema.safeParse({ githubUsername: "bad name!" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ contactEmail: "nope" }).success).toBe(false);
  });

  it("accepts an entirely empty form (nothing is mandatory)", () => {
    expect(profileFormSchema.safeParse({}).success).toBe(true);
  });
});

describe("experienceSchema", () => {
  const base = { company: "Acme", role: "Engineer", startDate: "2023-01", description: "Did things", status: "PUBLISHED" };

  it("parses months into dates and treats a missing end as current", () => {
    const parsed = experienceSchema.parse(base);
    expect(parsed.startDate.toISOString()).toBe("2023-01-01T00:00:00.000Z");
    expect(parsed.endDate).toBeNull();
  });

  it("rejects an end before the start", () => {
    const result = experienceSchema.safeParse({ ...base, endDate: "2022-12" });
    expect(result.success).toBe(false);
  });

  it("rejects bad month formats and missing required fields", () => {
    expect(experienceSchema.safeParse({ ...base, startDate: "01/2023" }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...base, company: "" }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...base, status: "HIDDEN" }).success).toBe(false);
  });
});

describe("educationSchema", () => {
  it("accepts a minimal entry", () => {
    const result = educationSchema.safeParse({
      institution: "Uni",
      degree: "BSc",
      startDate: "2015-09",
      status: "DRAFT",
    });
    expect(result.success).toBe(true);
  });
});

describe("technologySchema", () => {
  it("derives a slug and reads the checkbox", () => {
    const parsed = technologySchema.parse({ name: "Next.js", category: "FRONTEND", isKeySkill: "on" });
    expect(parsed.slug).toBe("next-js");
    expect(parsed.isKeySkill).toBe(true);
    expect(technologySchema.parse({ name: "Go", category: "LANGUAGE" }).isKeySkill).toBe(false);
  });

  it("rejects unknown categories and unusable names", () => {
    expect(technologySchema.safeParse({ name: "X", category: "OTHER" }).success).toBe(false);
    expect(technologySchema.safeParse({ name: "★★", category: "TOOL" }).success).toBe(false);
  });
});
