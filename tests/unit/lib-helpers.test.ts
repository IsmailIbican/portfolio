import { describe, expect, it } from "vitest";
import { formatRange, parseMonth, toMonthInput } from "@/lib/dates";
import { slugify } from "@/lib/slug";
import { isHttpUrl, isHttpUrlOrSitePath } from "@/lib/url";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Next.js Framework")).toBe("next-js-framework");
  });

  it("keeps C, C++ and C# distinct", () => {
    expect(new Set([slugify("C"), slugify("C++"), slugify("C#")]).size).toBe(3);
  });

  it("strips accents", () => {
    expect(slugify("Café")).toBe("cafe");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("★★★")).toBe("");
  });
});

describe("dates", () => {
  it("round-trips a month through parse and input format", () => {
    expect(toMonthInput(parseMonth("2023-06"))).toBe("2023-06");
  });

  it("formats open and closed ranges", () => {
    expect(formatRange(parseMonth("2023-06"), parseMonth("2024-02"))).toBe("Jun 2023 – Feb 2024");
    expect(formatRange(parseMonth("2023-06"), null)).toBe("Jun 2023 – Present");
  });

  it("returns an empty input value for no date", () => {
    expect(toMonthInput(null)).toBe("");
  });
});

describe("url helpers", () => {
  it("accepts http(s) URLs only", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,x")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("accepts site paths but not protocol-relative or backslash tricks", () => {
    expect(isHttpUrlOrSitePath("/uploads/cv.pdf")).toBe(true);
    expect(isHttpUrlOrSitePath("//evil.example")).toBe(false);
    expect(isHttpUrlOrSitePath("/\\evil.example")).toBe(false);
    expect(isHttpUrlOrSitePath("javascript:alert(1)")).toBe(false);
  });

  it("rejects tab, newline and control-character tricks that browsers normalise away", () => {
    expect(isHttpUrlOrSitePath("/\t/evil.example/cv.pdf")).toBe(false);
    expect(isHttpUrlOrSitePath("/\n/evil.example/cv.pdf")).toBe(false);
    expect(isHttpUrlOrSitePath("/\r/evil.example/cv.pdf")).toBe(false);
    expect(isHttpUrlOrSitePath("/ /evil.example")).toBe(false);
    expect(isHttpUrl("https://exa\tmple.com")).toBe(false);
  });

  it("keeps ordinary site paths working", () => {
    expect(isHttpUrlOrSitePath("/cv.pdf")).toBe(true);
    expect(isHttpUrlOrSitePath("/files/my-cv_2026.pdf")).toBe(true);
    expect(isHttpUrlOrSitePath("/%09/evil.example")).toBe(true);
  });
});
