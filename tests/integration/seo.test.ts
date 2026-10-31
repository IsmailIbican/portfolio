// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// sitemap() and robots() read the site address and the database from the environment when they run.
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.example");
});

beforeEach(async () => {
  await prisma.projectTechnology.deleteMany();
  await prisma.project.deleteMany();
});
afterAll(async () => {
  await prisma.project.deleteMany();
  await prisma.$disconnect();
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lists the static pages and only published projects, with absolute addresses", async () => {
    await prisma.project.createMany({
      data: [
        { slug: "live-one", title: "Live", summary: "s", status: "PUBLISHED", publishedAt: new Date() },
        { slug: "secret-draft", title: "Draft", summary: "s", status: "DRAFT" },
      ],
    });
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining(["https://portfolio.example", "https://portfolio.example/projects", "https://portfolio.example/about", "https://portfolio.example/tech-stack", "https://portfolio.example/contact"]));
    expect(urls).toContain("https://portfolio.example/projects/live-one");
    expect(urls.some((address) => address.includes("secret-draft"))).toBe(false);
    expect(urls.every((address) => address.startsWith("https://portfolio.example"))).toBe(true);
  });

  it("gives projects a last-modified date and never lists admin pages", async () => {
    await prisma.project.create({ data: { slug: "dated", title: "T", summary: "s", status: "PUBLISHED" } });
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    expect(entries.find((entry) => entry.url.endsWith("/projects/dated"))?.lastModified).toBeInstanceOf(Date);
    expect(entries.some((entry) => entry.url.includes("/admin"))).toBe(false);
  });
});

describe("robots", () => {
  it("allows the site, keeps crawlers out of admin and API routes, and points to the sitemap", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(expect.arrayContaining(["/admin", "/api/"]));
    expect(result.sitemap).toBe("https://portfolio.example/sitemap.xml");
  });
});
