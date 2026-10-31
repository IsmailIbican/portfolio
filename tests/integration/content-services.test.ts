// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createEducation, listPublishedEducation } from "@/features/education/service";
import { educationSchema } from "@/features/education/schema";
import {
  createExperience,
  deleteExperience,
  listExperience,
  listPublishedExperience,
  updateExperience,
} from "@/features/experience/service";
import { experienceSchema } from "@/features/experience/schema";
import { getProfile, getSiteSettings, saveProfile } from "@/features/profile/service";
import { profileFormSchema } from "@/features/profile/schema";
import { technologySchema } from "@/features/technologies/schema";
import {
  createTechnology,
  deleteTechnology,
  listKeySkills,
  listTechnologiesByCategory,
} from "@/features/technologies/service";
import { isRecordNotFound, isUniqueViolation } from "@/lib/db-errors";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function clean() {
  await prisma.projectTechnology.deleteMany();
  await prisma.technology.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.education.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.siteSettings.deleteMany();
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const exp = (over: Record<string, string>) =>
  experienceSchema.parse({ company: "Acme", role: "Engineer", startDate: "2020-01", description: "d", status: "PUBLISHED", ...over });

describe("profile service", () => {
  it("saves profile and settings, and updates them in place", async () => {
    await saveProfile(prisma, profileFormSchema.parse({ fullName: "A", siteTitle: "Site" }));
    await saveProfile(prisma, profileFormSchema.parse({ fullName: "B", siteTitle: "Site 2" }));

    expect((await getProfile(prisma))?.fullName).toBe("B");
    expect((await getSiteSettings(prisma))?.siteTitle).toBe("Site 2");
    expect(await prisma.profile.count()).toBe(1);
  });

  it("clears a field when the form sends it empty", async () => {
    await saveProfile(prisma, profileFormSchema.parse({ fullName: "A", headline: "H" }));
    await saveProfile(prisma, profileFormSchema.parse({ fullName: "A", headline: "" }));
    expect((await getProfile(prisma))?.headline).toBeNull();
  });
});

describe("experience service", () => {
  it("lists newest first and hides drafts from the public list", async () => {
    await createExperience(prisma, exp({ company: "Old", startDate: "2018-01" }));
    await createExperience(prisma, exp({ company: "New", startDate: "2022-01" }));
    await createExperience(prisma, exp({ company: "Hidden", startDate: "2023-01", status: "DRAFT" }));

    expect((await listExperience(prisma)).map((e) => e.company)).toEqual(["Hidden", "New", "Old"]);
    expect((await listPublishedExperience(prisma)).map((e) => e.company)).toEqual(["New", "Old"]);
    expect(await listPublishedExperience(prisma, 1)).toHaveLength(1);
  });

  it("updates and deletes, reporting a missing record", async () => {
    const created = await createExperience(prisma, exp({}));
    await updateExperience(prisma, created.id, exp({ role: "Lead" }));
    expect((await prisma.experience.findUniqueOrThrow({ where: { id: created.id } })).role).toBe("Lead");

    await deleteExperience(prisma, created.id);
    await expect(deleteExperience(prisma, created.id)).rejects.toSatisfy(isRecordNotFound);
  });
});

describe("education service", () => {
  it("only lists published entries publicly", async () => {
    const base = { institution: "U", degree: "BSc", startDate: "2010-09" };
    await createEducation(prisma, educationSchema.parse({ ...base, status: "PUBLISHED" }));
    await createEducation(prisma, educationSchema.parse({ ...base, institution: "Draft U", status: "DRAFT" }));
    expect((await listPublishedEducation(prisma)).map((e) => e.institution)).toEqual(["U"]);
  });
});

describe("technology service", () => {
  const tech = (name: string, category: string, isKeySkill?: string) =>
    technologySchema.parse({ name, category, isKeySkill });

  it("rejects duplicate names", async () => {
    await createTechnology(prisma, tech("Go", "LANGUAGE"));
    await expect(createTechnology(prisma, tech("Go", "LANGUAGE"))).rejects.toSatisfy(isUniqueViolation);
  });

  it("rejects names that produce the same slug", async () => {
    await createTechnology(prisma, tech("Next.js", "FRONTEND"));
    await expect(createTechnology(prisma, tech("next js", "FRONTEND"))).rejects.toSatisfy(isUniqueViolation);
  });

  it("groups by category in the fixed order and omits empty groups", async () => {
    await createTechnology(prisma, tech("PostgreSQL", "DATABASE"));
    await createTechnology(prisma, tech("TypeScript", "LANGUAGE"));
    await createTechnology(prisma, tech("Rust", "LANGUAGE"));

    const groups = await listTechnologiesByCategory(prisma);
    expect(groups.map((g) => g.category)).toEqual(["LANGUAGE", "DATABASE"]);
    expect(groups[0]?.items.map((i) => i.name)).toEqual(["Rust", "TypeScript"]);
  });

  it("lists only key skills and deletes", async () => {
    const a = await createTechnology(prisma, tech("A", "TOOL", "on"));
    await createTechnology(prisma, tech("B", "TOOL"));
    expect((await listKeySkills(prisma)).map((t) => t.name)).toEqual(["A"]);
    await deleteTechnology(prisma, a.id);
    expect(await listKeySkills(prisma)).toHaveLength(0);
  });
});
