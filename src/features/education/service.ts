import type { PrismaClient } from "@/generated/prisma/client";
import type { EducationData } from "./schema";

export function createEducation(db: PrismaClient, data: EducationData) {
  return db.education.create({ data });
}

export function updateEducation(db: PrismaClient, id: string, data: EducationData) {
  return db.education.update({ where: { id }, data });
}

export function deleteEducation(db: PrismaClient, id: string) {
  return db.education.delete({ where: { id } });
}

export function listEducation(db: PrismaClient) {
  return db.education.findMany({ orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
}

export function listPublishedEducation(db: PrismaClient) {
  return db.education.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
}
