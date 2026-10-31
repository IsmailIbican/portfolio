import type { PrismaClient } from "@/generated/prisma/client";
import type { ExperienceData } from "./schema";

export function createExperience(db: PrismaClient, data: ExperienceData) {
  return db.experience.create({ data });
}

export function updateExperience(db: PrismaClient, id: string, data: ExperienceData) {
  return db.experience.update({ where: { id }, data });
}

export function deleteExperience(db: PrismaClient, id: string) {
  return db.experience.delete({ where: { id } });
}

/** Admin list: everything, newest first. */
export function listExperience(db: PrismaClient) {
  return db.experience.findMany({ orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
}

/** Public list: published only, newest first. */
export function listPublishedExperience(db: PrismaClient, limit?: number) {
  return db.experience.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
