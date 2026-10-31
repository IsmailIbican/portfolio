import type { PrismaClient } from "@/generated/prisma/client";
import { TECHNOLOGY_CATEGORIES, type TechnologyData } from "./schema";

export function createTechnology(db: PrismaClient, data: TechnologyData) {
  return db.technology.create({ data });
}

export function updateTechnology(db: PrismaClient, id: string, data: TechnologyData) {
  return db.technology.update({ where: { id }, data });
}

/** Also removes the technology from any project it is attached to (cascade). */
export function deleteTechnology(db: PrismaClient, id: string) {
  return db.technology.delete({ where: { id } });
}

export function listTechnologies(db: PrismaClient) {
  return db.technology.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export function listKeySkills(db: PrismaClient) {
  return db.technology.findMany({ where: { isKeySkill: true }, orderBy: { name: "asc" } });
}

/** Technologies grouped in the fixed category order used by the Tech Stack page; empty groups are omitted. */
export async function listTechnologiesByCategory(db: PrismaClient) {
  const all = await db.technology.findMany({ orderBy: { name: "asc" } });
  return TECHNOLOGY_CATEGORIES.map((category) => ({
    category,
    items: all.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}
