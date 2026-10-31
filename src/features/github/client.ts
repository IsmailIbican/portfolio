import { z } from "zod";
import { isHttpUrl } from "@/lib/url";

const API = "https://api.github.com";
/** GitHub's rules for user names: letters, digits and single hyphens, up to 39 characters. */
const USERNAME = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const REPO_PART = /^[A-Za-z0-9._-]{1,100}$/;

export interface GithubRepo {
  fullName: string;
  name: string;
  ownerLogin: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  pushedAt: Date;
  fork: boolean;
  archived: boolean;
}

export type GithubErrorKind = "invalid-input" | "not-found" | "rate-limited" | "unavailable" | "invalid-response";

export class GithubError extends Error {
  constructor(
    readonly kind: GithubErrorKind,
    message: string,
    readonly resetAt?: Date,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

function isGithubPageUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === "github.com";
}

const repoSchema = z.object({
  full_name: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable(),
  // z.url() accepts any scheme (including javascript:), so the exact GitHub page is required.
  html_url: z.string().refine(isGithubPageUrl, "Must be a github.com URL"),
  // Public data only, enforced here rather than trusting the token's lack of access.
  private: z.boolean(),
  visibility: z.string().optional(),
  homepage: z.string().nullable().optional(),
  language: z.string().nullable(),
  stargazers_count: z.number().int().nonnegative(),
  pushed_at: z.string().nullable(),
  created_at: z.string(),
  fork: z.boolean(),
  archived: z.boolean(),
});

function toRepo(raw: z.infer<typeof repoSchema>): GithubRepo {
  return {
    fullName: raw.full_name,
    name: raw.name,
    ownerLogin: raw.owner.login,
    description: raw.description?.trim() || null,
    url: raw.html_url,
    homepage: raw.homepage?.trim() || null,
    language: raw.language,
    stars: raw.stargazers_count,
    // A repository that was never pushed to reports null; fall back to its creation date.
    pushedAt: new Date(raw.pushed_at ?? raw.created_at),
    fork: raw.fork,
    archived: raw.archived,
  };
}

export interface GithubOptions {
  /** Optional fine-grained token with no private access. It only raises the rate limit. */
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function request(path: string, { token, fetchImpl = fetch, timeoutMs = 8000 }: GithubOptions): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub rejects requests without a User-Agent.
        "User-Agent": "portfolio-site",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Always ask GitHub; caching is handled by what we store in our own database.
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new GithubError("unavailable", "Could not reach GitHub. Try again in a moment.");
  }

  // GitHub redirects renamed repositories within api.github.com. Anything that ends up elsewhere is not trusted.
  if (response.url && new URL(response.url).origin !== API) {
    throw new GithubError("invalid-response", "GitHub sent an unexpected response.");
  }

  if (response.status === 404) throw new GithubError("not-found", "GitHub user or repository not found.");

  if (response.status === 403 || response.status === 429) {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 429 || remaining === "0") {
      const resetAt = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : undefined;
      throw new GithubError("rate-limited", "GitHub's rate limit was reached. Try again later.", resetAt);
    }
    throw new GithubError("unavailable", "GitHub refused the request.");
  }

  if (!response.ok) throw new GithubError("unavailable", `GitHub answered with status ${response.status}.`);

  try {
    return await response.json();
  } catch {
    throw new GithubError("invalid-response", "GitHub sent an unreadable response.");
  }
}

const isPublic = (raw: z.infer<typeof repoSchema>) => !raw.private && (raw.visibility === undefined || raw.visibility === "public");

function parseRepos(data: unknown): GithubRepo[] {
  const parsed = z.array(repoSchema).safeParse(data);
  if (!parsed.success) throw new GithubError("invalid-response", "GitHub sent an unexpected response.");
  return parsed.data.filter(isPublic).map(toRepo);
}

/**
 * Public repositories of one user, newest push first. Uses /users/{name}/repos, which never includes private
 * repositories, even when a token is configured.
 */
export async function fetchPublicRepos(username: string, options: GithubOptions & { maxPages?: number } = {}): Promise<GithubRepo[]> {
  if (!USERNAME.test(username)) throw new GithubError("invalid-input", "That is not a valid GitHub username.");

  const perPage = 100;
  const maxPages = options.maxPages ?? 3;
  const repos: GithubRepo[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const batch = parseRepos(await request(`/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=${perPage}&page=${page}`, options));
    repos.push(...batch);
    if (batch.length < perPage) break;
  }

  return repos.sort((a, b) => b.pushedAt.getTime() - a.pushedAt.getTime());
}

/** One public repository by "owner/name". */
export async function fetchRepo(fullName: string, options: GithubOptions = {}): Promise<GithubRepo> {
  const [owner, name, ...rest] = fullName.split("/");
  if (!owner || !name || rest.length > 0 || !USERNAME.test(owner) || !REPO_PART.test(name) || name === "." || name === "..") {
    throw new GithubError("invalid-input", "That is not a valid repository name.");
  }

  const data = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, options);
  const parsed = repoSchema.safeParse(data);
  if (!parsed.success) throw new GithubError("invalid-response", "GitHub sent an unexpected response.");
  // A private repository must look exactly like a missing one.
  if (!isPublic(parsed.data)) throw new GithubError("not-found", "GitHub user or repository not found.");
  return toRepo(parsed.data);
}

export const isGithubUsername = (value: string) => USERNAME.test(value);
