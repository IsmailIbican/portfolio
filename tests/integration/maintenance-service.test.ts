// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import {
  deleteOldMessages,
  MAX_UPLOAD_DELETIONS_PER_RUN,
  MESSAGE_RETENTION_DAYS,
  referencedUploadUrls,
  sweepOrphanedUploads,
  UPLOAD_GRACE_HOURS,
} from "@/features/maintenance/service";
import type { Storage, StoredObject } from "@/lib/storage";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function clean() {
  await prisma.contactSubmission.deleteMany();
  await prisma.projectMedia.deleteMany();
  await prisma.project.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.siteSettings.deleteMany();
}
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const NOW = new Date("2026-06-15T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) => hoursAgo(days * 24);

/** Same shape as the keys the server generates, so the sweep recognises them as ours. */
const key = (n: number, folder = "images", extension = "png") => `${folder}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.${extension}`;
const localUrl = (n: number) => `/uploads/${key(n)}`;
const stored = (n: number, uploadedAt: Date): StoredObject => ({ url: localUrl(n), uploadedAt });

function fakeStorage(files: StoredObject[], remove: Storage["remove"] = async () => true) {
  const removed: string[] = [];
  const storage: Storage = {
    async put() {
      throw new Error("not used");
    },
    remove: vi.fn(async (fileUrl: string) => {
      removed.push(fileUrl);
      return remove(fileUrl);
    }),
    async list() {
      return files;
    },
  };
  return { storage, removed };
}

describe("deleteOldMessages", () => {
  const make = (name: string, createdAt: Date, status: "NEW" | "READ" | "ARCHIVED" = "NEW") =>
    prisma.contactSubmission.create({ data: { name, email: "a@example.com", message: "hello", createdAt, status } });

  it("deletes messages past the retention period and keeps newer ones, whatever their status", async () => {
    await make("old", daysAgo(MESSAGE_RETENTION_DAYS + 1));
    await make("old-archived", daysAgo(MESSAGE_RETENTION_DAYS + 30), "ARCHIVED");
    await make("recent", daysAgo(MESSAGE_RETENTION_DAYS - 1));
    await make("today", NOW);

    expect(await deleteOldMessages(prisma, NOW)).toBe(2);
    const left = await prisma.contactSubmission.findMany({ select: { name: true }, orderBy: { name: "asc" } });
    expect(left.map((message) => message.name)).toEqual(["recent", "today"]);
  });

  it("keeps a message that is exactly at the retention limit", async () => {
    await make("on-the-line", daysAgo(MESSAGE_RETENTION_DAYS));
    expect(await deleteOldMessages(prisma, NOW)).toBe(0);
  });
});

describe("referencedUploadUrls", () => {
  it("collects the photo, CV, social image and project images, ignoring empty fields", async () => {
    await prisma.profile.create({ data: { id: "singleton", avatarUrl: "/uploads/images/a.png", cvUrl: "/uploads/documents/cv.pdf" } });
    await prisma.siteSettings.create({ data: { id: "singleton", ogImageUrl: "/uploads/images/og.png" } });
    const project = await prisma.project.create({ data: { slug: "p", title: "P", summary: "S" } });
    await prisma.projectMedia.create({ data: { projectId: project.id, url: "/uploads/images/m.png", alt: "x" } });

    expect([...(await referencedUploadUrls(prisma))].sort()).toEqual([
      "/uploads/documents/cv.pdf",
      "/uploads/images/a.png",
      "/uploads/images/m.png",
      "/uploads/images/og.png",
    ]);
  });

  it("is empty on a fresh database", async () => {
    expect((await referencedUploadUrls(prisma)).size).toBe(0);
  });
});

describe("sweepOrphanedUploads", () => {
  it("deletes only old, unreferenced files", async () => {
    await prisma.profile.create({ data: { id: "singleton", avatarUrl: localUrl(1) } });
    const { storage, removed } = fakeStorage([stored(1, daysAgo(30)), stored(2, daysAgo(30)), stored(3, hoursAgo(UPLOAD_GRACE_HOURS - 1))]);

    expect(await sweepOrphanedUploads(prisma, storage, NOW)).toEqual({ checked: 3, deleted: 1, failed: 0 });
    expect(removed).toEqual([localUrl(2)]);
  });

  it("keeps a file that is exactly at the grace limit", async () => {
    const { storage, removed } = fakeStorage([stored(1, hoursAgo(UPLOAD_GRACE_HOURS))]);
    expect((await sweepOrphanedUploads(prisma, storage, NOW)).deleted).toBe(0);
    expect(removed).toEqual([]);
  });

  it("recognises a reference written with a query string, another host spelling or an absolute address", async () => {
    const project = await prisma.project.create({ data: { slug: "p", title: "P", summary: "S" } });
    await prisma.profile.create({ data: { id: "singleton", avatarUrl: `${localUrl(1)}?v=2`, cvUrl: `http://LOCALHOST:3000${localUrl(2)}` } });
    await prisma.projectMedia.create({ data: { projectId: project.id, url: `https://Store.public.blob.vercel-storage.com/${key(3)}#top`, alt: "x" } });
    const { storage, removed } = fakeStorage([stored(1, daysAgo(30)), stored(2, daysAgo(30)), stored(3, daysAgo(30)), stored(4, daysAgo(30))]);

    expect((await sweepOrphanedUploads(prisma, storage, NOW)).deleted).toBe(1);
    expect(removed).toEqual([localUrl(4)]);
  });

  it("never touches files that are not ours", async () => {
    const { storage, removed } = fakeStorage([
      { url: "/uploads/images/not-a-generated-name.png", uploadedAt: daysAgo(30) },
      { url: "https://example.com/somewhere/else.png", uploadedAt: daysAgo(30) },
    ]);
    expect(await sweepOrphanedUploads(prisma, storage, NOW)).toEqual({ checked: 2, deleted: 0, failed: 0 });
    expect(removed).toEqual([]);
  });

  it("caps how many files one run may delete, after leaving out the referenced ones", async () => {
    const total = MAX_UPLOAD_DELETIONS_PER_RUN + 20;
    const referencedCount = 15;
    const project = await prisma.project.create({ data: { slug: "p", title: "P", summary: "S" } });
    await prisma.projectMedia.createMany({
      data: Array.from({ length: referencedCount }, (_, index) => ({ projectId: project.id, url: localUrl(index), alt: "x" })),
    });
    const files = Array.from({ length: total }, (_, index) => stored(index, daysAgo(30)));
    const { storage, removed } = fakeStorage(files);

    const summary = await sweepOrphanedUploads(prisma, storage, NOW);
    expect(summary.deleted).toBe(MAX_UPLOAD_DELETIONS_PER_RUN);
    expect(removed).toHaveLength(MAX_UPLOAD_DELETIONS_PER_RUN);
    expect(removed.some((removedUrl) => files.slice(0, referencedCount).some((file) => file.url === removedUrl))).toBe(false);
  });

  it("deletes the oldest orphans first", async () => {
    const files = [stored(1, daysAgo(10)), stored(2, daysAgo(90)), stored(3, daysAgo(40))];
    const { storage, removed } = fakeStorage(files);
    await sweepOrphanedUploads(prisma, storage, NOW);
    expect(removed).toEqual([localUrl(2), localUrl(3), localUrl(1)]);
  });

  it("does not count deletions that failed or were ignored by the store", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { storage } = fakeStorage(
      [stored(1, daysAgo(30)), stored(2, daysAgo(30)), stored(3, daysAgo(30))],
      async (fileUrl) => {
        if (fileUrl === localUrl(1)) throw new Error("boom");
        return fileUrl !== localUrl(2); // 2: the store ignored it
      },
    );

    expect(await sweepOrphanedUploads(prisma, storage, NOW)).toEqual({ checked: 3, deleted: 1, failed: 2 });
    vi.restoreAllMocks();
  });

  it("lets a failing listing propagate", async () => {
    const storage: Storage = {
      put: async () => ({ url: "" }),
      remove: async () => true,
      list: async () => {
        throw new Error("store unavailable");
      },
    };
    await expect(sweepOrphanedUploads(prisma, storage, NOW)).rejects.toThrow("store unavailable");
  });
});
