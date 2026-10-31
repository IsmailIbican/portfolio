import type { PrismaClient } from "@/generated/prisma/client";
import type { Storage } from "@/lib/storage";
import { storageKeyOf } from "@/lib/storage/keys";

/** Contact messages are personal data (a name and an e-mail address), so they are not kept forever. */
export const MESSAGE_RETENTION_DAYS = 180;
/** A fresh upload sits unreferenced until the admin saves the form; give that time before calling it an orphan. */
export const UPLOAD_GRACE_HOURS = 24;
/** A bug that makes every file look unreferenced must not be able to empty the store in one run. */
export const MAX_UPLOAD_DELETIONS_PER_RUN = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export async function deleteOldMessages(db: PrismaClient, now = new Date(), retentionDays = MESSAGE_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  const result = await db.contactSubmission.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

/**
 * Every uploaded file the database still points to. A file not in this set is not used anywhere on the site.
 * Upload-bearing columns today: Profile.avatarUrl and cvUrl, SiteSettings.ogImageUrl, ProjectMedia.url. Project texts are
 * plain text and cannot embed files. Anything new that can hold an upload URL (v1.1 blog covers or Markdown) must be
 * added here, otherwise the sweep would delete files that are still in use.
 */
export async function referencedUploadUrls(db: PrismaClient): Promise<Set<string>> {
  const [profile, settings, media] = await Promise.all([
    db.profile.findUnique({ where: { id: "singleton" }, select: { avatarUrl: true, cvUrl: true } }),
    db.siteSettings.findUnique({ where: { id: "singleton" }, select: { ogImageUrl: true } }),
    db.projectMedia.findMany({ select: { url: true } }),
  ]);
  const urls = [profile?.avatarUrl, profile?.cvUrl, settings?.ogImageUrl, ...media.map((item) => item.url)];
  return new Set(urls.filter((url): url is string => Boolean(url)));
}

export interface SweepSummary {
  checked: number;
  deleted: number;
  /** Orphans that could not be deleted (the store refused, or the URL is not in our store). */
  failed: number;
}

/** Deletes uploads that no record references and that are older than the grace period. */
export async function sweepOrphanedUploads(db: PrismaClient, storage: Storage, now = new Date()): Promise<SweepSummary> {
  const cutoff = now.getTime() - UPLOAD_GRACE_HOURS * HOUR_MS;
  // Read the files first, then the references: a file uploaded in between is then either too new or already referenced.
  const files = await storage.list();
  // Compared by storage key, not by the raw text: an admin may have pasted the link with "?v=2" or another spelling of
  // the host, and that must not make a file in use look unreferenced.
  const referencedKeys = new Set([...(await referencedUploadUrls(db))].map(storageKeyOf));

  const orphans = files
    .filter((file) => {
      const key = storageKeyOf(file.url);
      return key !== null && file.uploadedAt.getTime() < cutoff && !referencedKeys.has(key);
    })
    .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
    .slice(0, MAX_UPLOAD_DELETIONS_PER_RUN);

  const results = await Promise.allSettled(orphans.map((file) => storage.remove(file.url)));
  let deleted = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) deleted++;
    else console.error(`maintenance: could not delete orphaned upload ${orphans[index]?.url}`, result.status === "rejected" ? result.reason : "");
  });
  return { checked: files.length, deleted, failed: orphans.length - deleted };
}
