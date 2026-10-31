import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db-errors";
import { slugify } from "@/lib/slug";
import { isHttpUrl } from "@/lib/url";
import { uniqueSlug } from "@/features/projects/service";
import { fetchPublicRepos, GithubError, type GithubOptions, type GithubRepo } from "./client";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Keep imported text within the limits of the project form, so an imported draft can always be edited and saved.
const TITLE_MAX = 120;
const SUMMARY_MAX = 300;
const URL_MAX = 2048;

/** GitHub-owned fields only. Title, summary and the rest are yours and are never overwritten by a sync. */
function metadata(repo: GithubRepo, now: Date) {
  return {
    githubStars: repo.stars,
    githubLanguage: repo.language,
    githubPushedAt: repo.pushedAt,
    githubSyncedAt: now,
  };
}

export type ImportResult = { status: "imported"; projectId: string } | { status: "already-imported"; projectId: string | null };

async function findLinked(db: PrismaClient, fullName: string) {
  // Compared in code, not with a case-insensitive SQL match: that uses ILIKE, where "_" is a wildcard
  // ("hello_world" would match "hello-world"). The table of linked projects is small.
  const linked = await db.project.findMany({ where: { githubRepo: { not: null } }, select: { id: true, githubRepo: true } });
  return linked.find((project) => project.githubRepo && same(project.githubRepo, fullName));
}

/** Creates a draft project from a repository. The page text is a starting point for you to edit. */
export async function importRepo(db: PrismaClient, repo: GithubRepo, now = new Date()): Promise<ImportResult> {
  const existing = await findLinked(db, repo.fullName);
  if (existing) return { status: "already-imported", projectId: existing.id };

  const homepage = repo.homepage && repo.homepage.length <= URL_MAX && isHttpUrl(repo.homepage) ? repo.homepage : null;

  // Two things can collide: the repository link (a second click) or the slug (a different repo with a similar name,
  // created at the same moment). Only the first means "already imported"; the second just needs another slug.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const project = await db.project.create({
        data: {
          slug: await uniqueSlug(db, slugify(repo.name)),
          title: repo.name.slice(0, TITLE_MAX),
          summary: (repo.description ?? repo.name).slice(0, SUMMARY_MAX),
          status: "DRAFT",
          githubRepo: repo.fullName,
          repoUrl: repo.url,
          liveUrl: homepage,
          ...metadata(repo, now),
        },
      });
      return { status: "imported", projectId: project.id };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await findLinked(db, repo.fullName);
      if (raced) return { status: "already-imported", projectId: raced.id };
      // Not the repository link, so it was the slug: loop to pick a new one.
    }
  }
  throw new Error("Could not find a free project address for this repository.");
}

export interface SyncSummary {
  updated: number;
  /** Linked projects whose repository is no longer public (renamed, deleted or made private). They are left untouched. */
  missing: string[];
}

/** Refreshes stars, language and last push for every project linked to a repository found in `repos`. */
export async function syncLinkedProjects(db: PrismaClient, repos: GithubRepo[], now = new Date()): Promise<SyncSummary> {
  const linked = await db.project.findMany({ where: { githubRepo: { not: null } }, select: { id: true, title: true, githubRepo: true } });

  let updated = 0;
  const missing: string[] = [];
  for (const project of linked) {
    const repo = repos.find((candidate) => project.githubRepo && same(candidate.fullName, project.githubRepo));
    if (!repo) {
      missing.push(project.title);
      continue;
    }
    await db.project.update({ where: { id: project.id }, data: metadata(repo, now) });
    updated++;
  }
  return { updated, missing };
}

/** Fetches the account's public repositories, refreshes the linked projects and records the outcome (also a failure). */
export async function syncFromGithub(db: PrismaClient, username: string, options: GithubOptions = {}): Promise<SyncSummary> {
  try {
    const repos = await fetchPublicRepos(username, options);
    const summary = await syncLinkedProjects(db, repos);
    await recordSync(db, null);
    return summary;
  } catch (error) {
    // If the database is the problem, recording the failure fails too; the GitHub error is still the one to surface.
    await recordSync(db, error).catch((recordError) => console.error("github: could not record the sync failure", recordError));
    throw error;
  }
}

export async function listLinkedRepoNames(db: PrismaClient): Promise<Map<string, string>> {
  const linked = await db.project.findMany({ where: { githubRepo: { not: null } }, select: { id: true, githubRepo: true } });
  return new Map(linked.flatMap((project) => (project.githubRepo ? [[project.githubRepo.toLowerCase(), project.id] as const] : [])));
}

/** Records the outcome on SiteSettings so the admin page can show when the last sync happened and whether it failed. */
export async function recordSync(db: PrismaClient, error: unknown, now = new Date()) {
  const message = error instanceof GithubError ? error.message : error ? "Unexpected error while syncing." : null;
  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: { githubLastSyncAt: message ? undefined : now, githubLastSyncError: message },
    create: { id: "singleton", githubLastSyncAt: message ? null : now, githubLastSyncError: message },
  });
}
