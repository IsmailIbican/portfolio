// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { projectFormInput, projectSchema } from "@/features/projects/schema";
import {
  addProjectMedia,
  createProject,
  deleteProject,
  deleteProjectMedia,
  getPublishedProjectBySlug,
  listFeaturedProjects,
  listFilterTechnologies,
  listPublishedProjects,
  listRelatedProjects,
  updateProject,
} from "@/features/projects/service";
import { isUniqueViolation } from "@/lib/db-errors";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function clean() {
  await prisma.projectTechnology.deleteMany();
  await prisma.projectMedia.deleteMany();
  await prisma.project.deleteMany();
  await prisma.technology.deleteMany();
}
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

function data(over: Record<string, string> = {}, technologyIds: string[] = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ title: "Project", summary: "Summary", status: "PUBLISHED", ...over })) form.set(key, value);
  for (const id of technologyIds) form.append("technologyIds", id);
  return projectSchema.parse(projectFormInput(form));
}

const tech = (name: string) =>
  prisma.technology.create({ data: { name, slug: name.toLowerCase(), category: "LANGUAGE" } });

describe("createProject", () => {
  it("generates a slug and makes duplicates unique", async () => {
    const a = await createProject(prisma, data({ title: "Cool App" }));
    const b = await createProject(prisma, data({ title: "Cool App" }));
    const c = await createProject(prisma, data({ title: "Cool App" }));
    expect([a.slug, b.slug, c.slug]).toEqual(["cool-app", "cool-app-2", "cool-app-3"]);
  });

  it("falls back to a default slug when the title has no usable characters", async () => {
    expect((await createProject(prisma, data({ title: "★★★" }))).slug).toBe("project");
  });

  it("rejects a manually chosen slug that is taken", async () => {
    await createProject(prisma, data({ slug: "taken" }));
    await expect(createProject(prisma, data({ slug: "taken" }))).rejects.toSatisfy(isUniqueViolation);
  });

  it("sets publishedAt only when published, and links technologies", async () => {
    const ts = await tech("TS");
    const draft = await createProject(prisma, data({ status: "DRAFT" }));
    const live = await createProject(prisma, data({ title: "Live" }, [ts.id]));
    expect(draft.publishedAt).toBeNull();
    expect(live.publishedAt).not.toBeNull();
    expect(await prisma.projectTechnology.count({ where: { projectId: live.id } })).toBe(1);
  });
});

describe("updateProject", () => {
  it("replaces technologies, keeps the slug unless one is given, and keeps the first publish date", async () => {
    const [a, b] = await Promise.all([tech("A"), tech("B")]);
    const project = await createProject(prisma, data({ title: "Keep" }, [a.id]));

    const updated = await updateProject(prisma, project.id, data({ title: "Renamed" }, [b.id]));
    expect(updated.slug).toBe("keep");
    expect(updated.publishedAt?.getTime()).toBe(project.publishedAt?.getTime());
    const links = await prisma.projectTechnology.findMany({ where: { projectId: project.id } });
    expect(links.map((l) => l.technologyId)).toEqual([b.id]);

    const renamed = await updateProject(prisma, project.id, data({ title: "Renamed", slug: "new-address" }));
    expect(renamed.slug).toBe("new-address");
  });

  it("sets publishedAt on the first transition from draft to published", async () => {
    const project = await createProject(prisma, data({ status: "DRAFT" }));
    const published = await updateProject(prisma, project.id, data({ status: "PUBLISHED" }));
    expect(published.publishedAt).not.toBeNull();
  });

  it("rolls back when a technology id does not exist", async () => {
    const t = await tech("Real");
    const project = await createProject(prisma, data({}, [t.id]));
    await expect(updateProject(prisma, project.id, data({}, ["does-not-exist"]))).rejects.toMatchObject({ code: "P2003" });
    expect(await prisma.projectTechnology.count({ where: { projectId: project.id } })).toBe(1);
  });
});

describe("public queries", () => {
  it("never expose drafts", async () => {
    await createProject(prisma, data({ title: "Hidden", status: "DRAFT", featured: "on" }));
    await createProject(prisma, data({ title: "Shown" }));
    expect((await listPublishedProjects(prisma)).map((p) => p.title)).toEqual(["Shown"]);
    expect(await listFeaturedProjects(prisma)).toHaveLength(0);
    expect(await getPublishedProjectBySlug(prisma, "hidden")).toBeNull();
    expect(await getPublishedProjectBySlug(prisma, "shown")).not.toBeNull();
  });

  it("orders featured first, then by order number", async () => {
    await createProject(prisma, data({ title: "Plain", sortOrder: "0" }));
    await createProject(prisma, data({ title: "Second", sortOrder: "2", featured: "on" }));
    await createProject(prisma, data({ title: "First", sortOrder: "1", featured: "on" }));
    expect((await listPublishedProjects(prisma)).map((p) => p.title)).toEqual(["First", "Second", "Plain"]);
    expect((await listFeaturedProjects(prisma, 1)).map((p) => p.title)).toEqual(["First"]);
  });

  it("filters by technology and lists only technologies used by published projects", async () => {
    const [ts, go, unused] = await Promise.all([tech("TS"), tech("Go"), tech("Unused")]);
    await createProject(prisma, data({ title: "A" }, [ts.id]));
    await createProject(prisma, data({ title: "B" }, [go.id]));
    await createProject(prisma, data({ title: "Draft", status: "DRAFT" }, [unused.id]));

    expect((await listPublishedProjects(prisma, { technologySlug: "ts" })).map((p) => p.title)).toEqual(["A"]);
    expect((await listFilterTechnologies(prisma)).map((t) => t.name)).toEqual(["Go", "TS"]);
  });

  it("finds related projects by shared technologies, most overlap first, excluding itself and drafts", async () => {
    const [a, b, c] = await Promise.all([tech("A"), tech("B"), tech("C")]);
    const main = await createProject(prisma, data({ title: "Main" }, [a.id, b.id]));
    await createProject(prisma, data({ title: "One shared" }, [a.id]));
    await createProject(prisma, data({ title: "Two shared" }, [a.id, b.id]));
    await createProject(prisma, data({ title: "None shared" }, [c.id]));
    await createProject(prisma, data({ title: "Draft match", status: "DRAFT" }, [a.id, b.id]));

    const related = await listRelatedProjects(prisma, { id: main.id, technologyIds: [a.id, b.id] });
    expect(related.map((p) => p.title)).toEqual(["Two shared", "One shared"]);
    expect(await listRelatedProjects(prisma, { id: main.id, technologyIds: [] })).toEqual([]);
  });
});

describe("media and deletion", () => {
  it("appends media in order and returns the file URL on delete", async () => {
    const project = await createProject(prisma, data());
    const first = await addProjectMedia(prisma, project.id, { url: "/uploads/images/a.png", alt: "A" });
    const second = await addProjectMedia(prisma, project.id, { url: "/uploads/images/b.png", alt: "B" });
    expect([first.sortOrder, second.sortOrder]).toEqual([0, 1]);

    expect(await deleteProjectMedia(prisma, first.id)).toBe("/uploads/images/a.png");
    const found = await getPublishedProjectBySlug(prisma, project.slug);
    expect(found?.media.map((m) => m.alt)).toEqual(["B"]);
  });

  it("deleting a project returns its file URLs and removes media and links", async () => {
    const t = await tech("T");
    const project = await createProject(prisma, data({}, [t.id]));
    await addProjectMedia(prisma, project.id, { url: "/uploads/images/a.png", alt: "A" });

    expect(await deleteProject(prisma, project.id)).toEqual(["/uploads/images/a.png"]);
    expect(await prisma.projectMedia.count()).toBe(0);
    expect(await prisma.projectTechnology.count()).toBe(0);
    expect(await prisma.technology.count()).toBe(1);
  });
});
