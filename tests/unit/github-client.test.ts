// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchPublicRepos, fetchRepo, GithubError } from "@/features/github/client";

const rawRepo = (over: Record<string, unknown> = {}) => ({
  full_name: "octo/hello",
  name: "hello",
  owner: { login: "octo" },
  description: "  A repo  ",
  html_url: "https://github.com/octo/hello",
  homepage: "",
  language: "TypeScript",
  stargazers_count: 7,
  pushed_at: "2026-01-02T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
  fork: false,
  archived: false,
  private: false,
  ...over,
});

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("fetchPublicRepos", () => {
  it("maps repositories and sorts by latest push", async () => {
    const fetchImpl = vi.fn(async () =>
      json([
        rawRepo({ full_name: "octo/old", name: "old", pushed_at: "2024-01-01T00:00:00Z" }),
        rawRepo({ full_name: "octo/new", name: "new", pushed_at: "2026-06-01T00:00:00Z" }),
      ]),
    );
    const repos = await fetchPublicRepos("octo", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(repos.map((repo) => repo.name)).toEqual(["new", "old"]);
    expect(repos[0]).toMatchObject({ stars: 7, language: "TypeScript", description: "A repo", homepage: null, fork: false });
  });

  it("asks only for public data, with the required headers and no token by default", async () => {
    const fetchImpl = vi.fn(async () => json([]));
    await fetchPublicRepos("octo", { fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://api.github.com/users/octo/repos");
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeTruthy();
    expect(headers.Authorization).toBeUndefined();
    expect(init.cache).toBe("no-store");
  });

  it("sends the token only when configured", async () => {
    const fetchImpl = vi.fn(async () => json([]));
    await fetchPublicRepos("octo", { token: "t0ken", fetchImpl: fetchImpl as unknown as typeof fetch });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0ken");
  });

  it("follows pages until a short page, and stops at maxPages", async () => {
    const full = Array.from({ length: 100 }, (_, index) => rawRepo({ full_name: `octo/r${index}`, name: `r${index}` }));
    const fetchImpl = vi.fn(async () => json(full));
    const repos = await fetchPublicRepos("octo", { fetchImpl: fetchImpl as unknown as typeof fetch, maxPages: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(repos).toHaveLength(200);
  });

  it("falls back to the creation date for a repository that was never pushed", async () => {
    const fetchImpl = vi.fn(async () => json([rawRepo({ pushed_at: null })]));
    const [repo] = await fetchPublicRepos("octo", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(repo?.pushedAt.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("rejects invalid usernames without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    for (const bad of ["", "-lead", "has space", "../etc", "a".repeat(40), "a/b"]) {
      await expect(fetchPublicRepos(bad, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toMatchObject({ kind: "invalid-input" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports not found", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 404 }));
    await expect(fetchPublicRepos("ghost", { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toMatchObject({ kind: "not-found" });
  });

  it("reports the rate limit with its reset time", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" } }),
    );
    const error = await fetchPublicRepos("octo", { fetchImpl: fetchImpl as unknown as typeof fetch }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GithubError);
    expect(error).toMatchObject({ kind: "rate-limited" });
    expect((error as GithubError).resetAt?.getTime()).toBe(1893456000 * 1000);
  });

  it("treats other 403s, server errors and network failures as unavailable", async () => {
    const make = (response: () => Promise<Response>) => fetchPublicRepos("octo", { fetchImpl: vi.fn(response) as unknown as typeof fetch });
    await expect(make(async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "40" } }))).rejects.toMatchObject({ kind: "unavailable" });
    await expect(make(async () => new Response("oops", { status: 502 }))).rejects.toMatchObject({ kind: "unavailable" });
    await expect(make(async () => Promise.reject(new TypeError("fetch failed")))).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("rejects responses that do not look like repositories", async () => {
    const make = (body: unknown) => fetchPublicRepos("octo", { fetchImpl: vi.fn(async () => json(body)) as unknown as typeof fetch });
    await expect(make({ message: "hello" })).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(make([{ name: "no other fields" }])).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(make([rawRepo({ html_url: "javascript:alert(1)" })])).rejects.toMatchObject({ kind: "invalid-response" });
  });
});

describe("public data only", () => {
  const list = (body: unknown) => fetchPublicRepos("octo", { fetchImpl: vi.fn(async () => json(body)) as unknown as typeof fetch });

  it("drops private repositories from lists, even if GitHub sends them", async () => {
    const repos = await list([
      rawRepo({ full_name: "octo/open", name: "open" }),
      rawRepo({ full_name: "octo/secret", name: "secret", private: true }),
      rawRepo({ full_name: "octo/internal", name: "internal", visibility: "internal" }),
    ]);
    expect(repos.map((repo) => repo.name)).toEqual(["open"]);
  });

  it("treats a private repository as not found when fetched directly", async () => {
    const fetchImpl = vi.fn(async () => json(rawRepo({ private: true, visibility: "private" })));
    await expect(fetchRepo("octo/secret", { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toMatchObject({ kind: "not-found" });
  });

  it("requires the repository page to be on github.com over https", async () => {
    await expect(list([rawRepo({ html_url: "https://evil.example/octo/hello" })])).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(list([rawRepo({ html_url: "http://github.com/octo/hello" })])).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(list([rawRepo({ html_url: "https://github.com/octo/hello" })])).resolves.toHaveLength(1);
  });

  it("refuses a response that ended up on another host after a redirect", async () => {
    const response = json([rawRepo()]);
    Object.defineProperty(response, "url", { value: "https://evil.example/users/octo/repos" });
    await expect(fetchPublicRepos("octo", { fetchImpl: vi.fn(async () => response) as unknown as typeof fetch })).rejects.toMatchObject({
      kind: "invalid-response",
    });
  });

  it("accepts a redirect that stays on api.github.com (renamed repository)", async () => {
    const response = json(rawRepo());
    Object.defineProperty(response, "url", { value: "https://api.github.com/repositories/123" });
    const repo = await fetchRepo("octo/old-name", { fetchImpl: vi.fn(async () => response) as unknown as typeof fetch });
    expect(repo.fullName).toBe("octo/hello");
  });
});

describe("fetchRepo", () => {
  it("fetches a single repository", async () => {
    const fetchImpl = vi.fn(async () => json(rawRepo()));
    const repo = await fetchRepo("octo/hello", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(repo.fullName).toBe("octo/hello");
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.github.com/repos/octo/hello");
  });

  it("rejects malformed names without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    for (const bad of ["octo", "octo/", "/hello", "octo/hello/extra", "octo/..", "octo/a b", "-x/hello", "octo/hello?x=1"]) {
      await expect(fetchRepo(bad, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toMatchObject({ kind: "invalid-input" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
