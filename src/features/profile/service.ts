import type { PrismaClient } from "@/generated/prisma/client";
import type { ProfileFormData } from "./schema";

const SINGLETON = "singleton";

export async function saveProfile(db: PrismaClient, { profile, settings }: ProfileFormData) {
  await db.$transaction([
    db.profile.upsert({ where: { id: SINGLETON }, update: profile, create: { id: SINGLETON, ...profile } }),
    db.siteSettings.upsert({ where: { id: SINGLETON }, update: settings, create: { id: SINGLETON, ...settings } }),
  ]);
}

export function getProfile(db: PrismaClient) {
  return db.profile.findUnique({ where: { id: SINGLETON } });
}

export function getSiteSettings(db: PrismaClient) {
  return db.siteSettings.findUnique({ where: { id: SINGLETON } });
}
