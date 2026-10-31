import { describe, expect, it } from "vitest";
import { mediaAltSchema, projectFormInput, projectSchema } from "@/features/projects/schema";

const base = { title: "My App", summary: "Does things", status: "DRAFT" };

describe("projectSchema", () => {
  it("accepts a minimal project with sensible defaults", () => {
    const parsed = projectSchema.parse({ ...base, technologyIds: [] });
    expect(parsed.featured).toBe(false);
    expect(parsed.sortOrder).toBe(0);
    expect(parsed.slug).toBeNull();
    expect(parsed.repoUrl).toBeNull();
  });

  it("requires title, summary and a valid status", () => {
    expect(projectSchema.safeParse({ ...base, title: "", technologyIds: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, summary: "", technologyIds: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, status: "LIVE", technologyIds: [] }).success).toBe(false);
  });

  it("only accepts http(s) links", () => {
    expect(projectSchema.safeParse({ ...base, repoUrl: "javascript:alert(1)", technologyIds: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, liveUrl: "https://example.com", technologyIds: [] }).success).toBe(true);
  });

  it("validates a custom slug", () => {
    expect(projectSchema.safeParse({ ...base, slug: "my-app", technologyIds: [] }).success).toBe(true);
    expect(projectSchema.safeParse({ ...base, slug: "My App", technologyIds: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, slug: "../etc", technologyIds: [] }).success).toBe(false);
  });

  it("parses order as a bounded whole number", () => {
    expect(projectSchema.parse({ ...base, sortOrder: "3", technologyIds: [] }).sortOrder).toBe(3);
    expect(projectSchema.safeParse({ ...base, sortOrder: "1.5", technologyIds: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, sortOrder: "abc", technologyIds: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, sortOrder: "99999", technologyIds: [] }).success).toBe(false);
  });

  it("ignores fields it does not know, such as publishedAt", () => {
    const parsed = projectSchema.parse({ ...base, publishedAt: "2000-01-01", id: "x", technologyIds: [] });
    expect(parsed).not.toHaveProperty("publishedAt");
    expect(parsed).not.toHaveProperty("id");
  });
});

describe("projectFormInput", () => {
  it("keeps every selected technology, not just the last", () => {
    const form = new FormData();
    form.append("title", "T");
    form.append("technologyIds", "a");
    form.append("technologyIds", "b");
    expect(projectFormInput(form).technologyIds).toEqual(["a", "b"]);
  });

  it("drops duplicate technology ids so a double-posted form cannot break the save", () => {
    const parsed = projectSchema.parse({ ...base, technologyIds: ["a", "b", "a", "b", "a"] });
    expect(parsed.technologyIds).toEqual(["a", "b"]);
  });

  it("gives an empty list when nothing is selected", () => {
    expect(projectFormInput(new FormData()).technologyIds).toEqual([]);
  });
});

describe("mediaAltSchema", () => {
  it("requires a description", () => {
    expect(mediaAltSchema.safeParse("   ").success).toBe(false);
    expect(mediaAltSchema.safeParse("Dashboard screenshot").success).toBe(true);
  });
});
