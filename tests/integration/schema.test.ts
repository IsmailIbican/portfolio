// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

// Runs against a disposable local database (docker-compose.yml, database `portfolio_test`).
const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";

// Safety: these tests delete every row, so they refuse to touch anything not named *_test.
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function clean() {
  await prisma.projectTechnology.deleteMany();
  await prisma.projectMedia.deleteMany();
  await prisma.project.deleteMany();
  await prisma.technology.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.education.deleteMany();
  await prisma.contactSubmission.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.siteSettings.deleteMany();
  await prisma.adminUser.deleteMany();
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("database schema", () => {
  it("enforces unique project slugs", async () => {
    await prisma.project.create({ data: { slug: "a", title: "A", summary: "s" } });
    await expect(prisma.project.create({ data: { slug: "a", title: "B", summary: "s" } })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("creates projects as DRAFT and not featured by default", async () => {
    const project = await prisma.project.create({ data: { slug: "p", title: "P", summary: "s" } });
    expect(project.status).toBe("DRAFT");
    expect(project.featured).toBe(false);
  });

  it("cascades deletes from a project to its media and technology links", async () => {
    const tech = await prisma.technology.create({ data: { name: "TypeScript", slug: "typescript", category: "LANGUAGE" } });
    const project = await prisma.project.create({
      data: {
        slug: "p",
        title: "P",
        summary: "s",
        media: { create: { url: "/x.png", alt: "x" } },
        technologies: { create: { technologyId: tech.id } },
      },
    });
    await prisma.project.delete({ where: { id: project.id } });
    expect(await prisma.projectMedia.count()).toBe(0);
    expect(await prisma.projectTechnology.count()).toBe(0);
    expect(await prisma.technology.count()).toBe(1);
  });

  it("enforces unique technology names", async () => {
    await prisma.technology.create({ data: { name: "Go", slug: "go", category: "LANGUAGE" } });
    await expect(
      prisma.technology.create({ data: { name: "Go", slug: "go-2", category: "LANGUAGE" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps profile and settings as single rows", async () => {
    for (let i = 0; i < 2; i++) {
      await prisma.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
      await prisma.siteSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    }
    expect(await prisma.profile.count()).toBe(1);
    expect(await prisma.siteSettings.count()).toBe(1);
  });

  it("stores contact submissions as NEW without a raw IP field", async () => {
    const submission = await prisma.contactSubmission.create({
      data: { name: "N", email: "n@example.com", message: "hello" },
    });
    expect(submission.status).toBe("NEW");
    expect(submission).not.toHaveProperty("ip");
  });

  it("enforces unique admin emails", async () => {
    await prisma.adminUser.create({ data: { email: "a@example.com", passwordHash: "x" } });
    await expect(prisma.adminUser.create({ data: { email: "a@example.com", passwordHash: "y" } })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});
