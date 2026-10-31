import type { PrismaClient } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import type { ProjectData } from "./schema";

/** Finds a free slug: "my-app", then "my-app-2", "my-app-3"... */
export async function uniqueSlug(db: PrismaClient, base: string): Promise<string> {
  const root = base || "project";
  for (let attempt = 1; attempt < 100; attempt++) {
    const candidate = attempt === 1 ? root : `${root}-${attempt}`;
    const taken = await db.project.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Columns shared by create and update (slug and technology links are handled separately). */
function fields(data: ProjectData) {
  return {
    title: data.title,
    summary: data.summary,
    overview: data.overview,
    problem: data.problem,
    solution: data.solution,
    architecture: data.architecture,
    implementation: data.implementation,
    challenges: data.challenges,
    results: data.results,
    repoUrl: data.repoUrl,
    liveUrl: data.liveUrl,
    status: data.status,
    featured: data.featured,
    sortOrder: data.sortOrder,
  };
}

export async function createProject(db: PrismaClient, data: ProjectData) {
  const slug = data.slug ?? (await uniqueSlug(db, slugify(data.title)));
  return db.project.create({
    data: {
      ...fields(data),
      slug,
      publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      technologies: { create: data.technologyIds.map((technologyId) => ({ technologyId })) },
    },
  });
}

export async function updateProject(db: PrismaClient, id: string, data: ProjectData) {
  return db.$transaction(async (tx) => {
    const current = await tx.project.findUniqueOrThrow({ where: { id }, select: { publishedAt: true } });
    await tx.projectTechnology.deleteMany({ where: { projectId: id } });
    return tx.project.update({
      where: { id },
      data: {
        ...fields(data),
        ...(data.slug ? { slug: data.slug } : {}),
        // The first publication date sticks, so unpublishing and republishing does not reorder history.
        publishedAt: data.status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
        technologies: { create: data.technologyIds.map((technologyId) => ({ technologyId })) },
      },
    });
  });
}

/** Deletes the project and returns the file URLs that were attached, so the caller can remove them from storage. */
export function deleteProject(db: PrismaClient, id: string): Promise<string[]> {
  // One transaction, so media added at the same moment cannot be cascade-deleted without being reported.
  return db.$transaction(async (tx) => {
    const media = await tx.projectMedia.findMany({ where: { projectId: id }, select: { url: true } });
    await tx.project.delete({ where: { id } });
    return media.map((item) => item.url);
  });
}

export async function addProjectMedia(db: PrismaClient, projectId: string, input: { url: string; alt: string }) {
  const last = await db.projectMedia.aggregate({ where: { projectId }, _max: { sortOrder: true } });
  return db.projectMedia.create({
    data: { projectId, url: input.url, alt: input.alt, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
}

/** Returns the removed file's URL so the caller can delete it from storage. */
export async function deleteProjectMedia(db: PrismaClient, id: string): Promise<string> {
  const removed = await db.projectMedia.delete({ where: { id } });
  return removed.url;
}

// ---- Admin reads ----

export function listProjects(db: PrismaClient) {
  return db.project.findMany({ orderBy: [{ createdAt: "desc" }] });
}

export function getProject(db: PrismaClient, id: string) {
  return db.project.findUnique({
    where: { id },
    include: { media: { orderBy: { sortOrder: "asc" } }, technologies: { select: { technologyId: true } } },
  });
}

// ---- Public reads (published only) ----

const publicInclude = {
  media: { orderBy: { sortOrder: "asc" as const } },
  technologies: { include: { technology: true } },
};

const publicOrder = [{ featured: "desc" as const }, { sortOrder: "asc" as const }, { publishedAt: "desc" as const }];

export function listPublishedProjects(db: PrismaClient, options: { technologySlug?: string } = {}) {
  return db.project.findMany({
    where: {
      status: "PUBLISHED",
      ...(options.technologySlug ? { technologies: { some: { technology: { slug: options.technologySlug } } } } : {}),
    },
    include: publicInclude,
    orderBy: publicOrder,
  });
}

export function listFeaturedProjects(db: PrismaClient, limit = 3) {
  return db.project.findMany({
    where: { status: "PUBLISHED", featured: true },
    include: publicInclude,
    orderBy: publicOrder,
    take: limit,
  });
}

export function getPublishedProjectBySlug(db: PrismaClient, slug: string) {
  return db.project.findFirst({ where: { slug, status: "PUBLISHED" }, include: publicInclude });
}

/** Technologies used by at least one published project: the options of the filter on /projects. */
export function listFilterTechnologies(db: PrismaClient) {
  return db.technology.findMany({
    where: { projects: { some: { project: { status: "PUBLISHED" } } } },
    orderBy: { name: "asc" },
  });
}

/** Other published projects that share technologies with this one, most overlap first. */
export async function listRelatedProjects(db: PrismaClient, project: { id: string; technologyIds: string[] }, limit = 3) {
  if (project.technologyIds.length === 0) return [];

  const candidates = await db.project.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: project.id },
      technologies: { some: { technologyId: { in: project.technologyIds } } },
    },
    include: publicInclude,
  });

  const shared = (candidate: (typeof candidates)[number]) =>
    candidate.technologies.filter((link) => project.technologyIds.includes(link.technologyId)).length;

  return candidates
    .sort((a, b) => shared(b) - shared(a) || a.sortOrder - b.sortOrder)
    .slice(0, limit);
}
