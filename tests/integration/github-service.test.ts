// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { GithubError, type GithubRepo } from "@/features/github/client";
import { importRepo, listLinkedRepoNames, recordSync, syncFromGithub, syncLinkedProjects } from "@/features/github/service";

// Only the network call is replaced; GithubError and everything else stay real. A plain function rather than vi.fn():
// vitest's call tracking reports a rejected result of a mock as a failure of the test, even when the test expects it.
const github = vi.hoisted(() => ({ calls: [] as unknown[][], fetch: (async () => []) as (...args: unknown[]) => Promise<unknown> }));
vi.mock("@/features/github/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/github/client")>()),
  fetchPublicRepos: (...args: unknown[]) => {
    github.calls.push(args);
    return github.fetch(...args);
  },
}));

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function clean() {
  await prisma.projectTechnology.deleteMany();
  await prisma.projectMedia.deleteMany();
  await prisma.project.deleteMany();
  await prisma.siteSettings.deleteMany();
}
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const repo = (over: Partial<GithubRepo> = {}): GithubRepo => ({
  fullName: "octo/hello-world",
  name: "hello-world",
  ownerLogin: "octo",
  description: "My first repo",
  url: "https://github.com/octo/hello-world",
  homepage: "https://hello.example.com",
  language: "TypeScript",
  stars: 5,
  pushedAt: new Date("2026-03-01T00:00:00Z"),
  fork: false,
  archived: false,
  ...over,
});

describe("importRepo", () => {
  it("creates a hidden draft project from the repository", async () => {
    const result = await importRepo(prisma, repo());
    expect(result.status).toBe("imported");

    const project = await prisma.project.findFirstOrThrow();
    expect(project).toMatchObject({
      slug: "hello-world",
      title: "hello-world",
      summary: "My first repo",
      status: "DRAFT",
      featured: false,
      githubRepo: "octo/hello-world",
      repoUrl: "https://github.com/octo/hello-world",
      liveUrl: "https://hello.example.com",
      githubStars: 5,
      githubLanguage: "TypeScript",
    });
    expect(project.publishedAt).toBeNull();
  });

  it("uses the name as summary when there is no description, and ignores a non-http homepage", async () => {
    await importRepo(prisma, repo({ description: null, homepage: "javascript:alert(1)" }));
    const project = await prisma.project.findFirstOrThrow();
    expect(project.summary).toBe("hello-world");
    expect(project.liveUrl).toBeNull();
  });

  it("does not import the same repository twice, whatever its letter case", async () => {
    const first = await importRepo(prisma, repo());
    const second = await importRepo(prisma, repo({ fullName: "Octo/Hello-World" }));
    expect(second).toEqual({ status: "already-imported", projectId: first.status === "imported" ? first.projectId : null });
    expect(await prisma.project.count()).toBe(1);
  });

  it("copes with two simultaneous imports of the same repository", async () => {
    const results = await Promise.all([importRepo(prisma, repo()), importRepo(prisma, repo())]);
    expect(results.filter((result) => result.status === "imported")).toHaveLength(1);
    expect(await prisma.project.count()).toBe(1);
  });

  it("gives different repositories with the same name distinct slugs", async () => {
    await importRepo(prisma, repo());
    await importRepo(prisma, repo({ fullName: "octo/hello_world", name: "hello_world" }));
    expect((await prisma.project.findMany({ orderBy: { slug: "asc" } })).map((p) => p.slug)).toEqual(["hello-world", "hello-world-2"]);
  });
});

describe("importRepo edge cases", () => {
  it("trims long GitHub text to what the project form accepts", async () => {
    await importRepo(prisma, repo({ description: "d".repeat(400), name: "n".repeat(150), fullName: `octo/${"n".repeat(150)}` }));
    const project = await prisma.project.findFirstOrThrow();
    expect(project.summary).toHaveLength(300);
    expect(project.title).toHaveLength(120);
  });

  it("drops an overlong homepage instead of storing it", async () => {
    await importRepo(prisma, repo({ homepage: `https://example.com/${"a".repeat(2100)}` }));
    expect((await prisma.project.findFirstOrThrow()).liveUrl).toBeNull();
  });

  it("imports two different repositories that slugify identically, even at the same moment", async () => {
    const results = await Promise.all([
      importRepo(prisma, repo({ fullName: "octo/My_App", name: "My_App" })),
      importRepo(prisma, repo({ fullName: "octo/my-app", name: "my-app" })),
    ]);
    expect(results.map((result) => result.status)).toEqual(["imported", "imported"]);
    const slugs = (await prisma.project.findMany()).map((project) => project.slug).sort();
    expect(slugs).toEqual(["my-app", "my-app-2"]);
  });
});

describe("syncLinkedProjects", () => {
  it("refreshes GitHub-owned fields but never your own text", async () => {
    await importRepo(prisma, repo());
    await prisma.project.updateMany({ data: { title: "My custom title", summary: "My custom summary", featured: true, status: "PUBLISHED" } });

    const summary = await syncLinkedProjects(prisma, [repo({ stars: 99, language: "Rust", pushedAt: new Date("2026-09-09T00:00:00Z") })]);
    expect(summary).toEqual({ updated: 1, missing: [] });

    const project = await prisma.project.findFirstOrThrow();
    expect(project).toMatchObject({ githubStars: 99, githubLanguage: "Rust", title: "My custom title", summary: "My custom summary", featured: true, status: "PUBLISHED" });
    expect(project.githubPushedAt?.toISOString()).toBe("2026-09-09T00:00:00.000Z");
    expect(project.githubSyncedAt).not.toBeNull();
  });

  it("reports linked projects whose repository is gone and leaves them alone", async () => {
    await importRepo(prisma, repo());
    const summary = await syncLinkedProjects(prisma, [repo({ fullName: "octo/other", name: "other" })]);
    expect(summary).toEqual({ updated: 0, missing: ["hello-world"] });
    expect((await prisma.project.findFirstOrThrow()).githubStars).toBe(5);
  });

  it("ignores manual projects that have no repository", async () => {
    await prisma.project.create({ data: { slug: "manual", title: "Manual", summary: "No repo" } });
    expect(await syncLinkedProjects(prisma, [repo()])).toEqual({ updated: 0, missing: [] });
  });

  it("maps linked repositories for the admin list", async () => {
    await importRepo(prisma, repo());
    const linked = await listLinkedRepoNames(prisma);
    expect(linked.has("octo/hello-world")).toBe(true);
  });
});

describe("recordSync", () => {
  it("stores the time on success and the message on failure, keeping the last good time", async () => {
    await recordSync(prisma, null, new Date("2026-05-05T00:00:00Z"));
    let settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(settings.githubLastSyncAt?.toISOString()).toBe("2026-05-05T00:00:00.000Z");
    expect(settings.githubLastSyncError).toBeNull();

    await recordSync(prisma, new GithubError("rate-limited", "GitHub's rate limit was reached. Try again later."));
    settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(settings.githubLastSyncAt?.toISOString()).toBe("2026-05-05T00:00:00.000Z");
    expect(settings.githubLastSyncError).toContain("rate limit");
  });

  it("does not leak the text of unexpected errors", async () => {
    await recordSync(prisma, new Error("connection string postgres://user:secret@host"));
    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(settings.githubLastSyncError).toBe("Unexpected error while syncing.");
  });
});

describe("syncFromGithub", () => {
  beforeEach(() => {
    github.calls = [];
    github.fetch = async () => [];
  });

  it("refreshes linked projects and records the time", async () => {
    await importRepo(prisma, repo({ stars: 1 }));
    github.fetch = async () => [repo({ stars: 42 })];

    const summary = await syncFromGithub(prisma, "octo", { token: "t" });

    expect(summary).toEqual({ updated: 1, missing: [] });
    expect(github.calls).toEqual([["octo", { token: "t" }]]);
    expect((await prisma.project.findFirstOrThrow()).githubStars).toBe(42);
    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(settings.githubLastSyncAt).not.toBeNull();
    expect(settings.githubLastSyncError).toBeNull();
  });

  it("records the failure and rethrows the original error", async () => {
    const failure = new GithubError("rate-limited", "GitHub's rate limit was reached. Try again later.");
    github.fetch = async () => {
      throw failure;
    };

    const thrown = await syncFromGithub(prisma, "octo").catch((error: unknown) => error);
    expect(thrown).toBe(failure);

    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(settings.githubLastSyncError).toContain("rate limit");
  });
});
