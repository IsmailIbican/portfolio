import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchPublicRepos, GithubError, type GithubRepo } from "@/features/github/client";
import { listLinkedRepoNames } from "@/features/github/service";
import { getProfile, getSiteSettings } from "@/features/profile/service";
import { formatMonth } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { importRepoAction, syncAction } from "./actions";

export const metadata = { title: "GitHub" };

const NOTICES: Record<string, { error: boolean; text: string }> = {
  "no-username": { error: true, text: "Add your GitHub username on the Profile page first." },
  "not-owner": { error: true, text: "That repository does not belong to your GitHub account." },
  "already-imported": { error: false, text: "That repository is already a project." },
  "not-found": { error: true, text: "GitHub could not find that user or repository." },
  "rate-limited": { error: true, text: "GitHub's rate limit was reached. Try again later, or add a GITHUB_TOKEN to raise the limit." },
  unavailable: { error: true, text: "Could not reach GitHub. Try again in a moment." },
  "invalid-response": { error: true, text: "GitHub sent an unexpected response. Try again later." },
  "invalid-input": { error: true, text: "That is not a valid GitHub name." },
};

const count = (value: string | string[] | undefined) => {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed < 10_000 ? parsed : null;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminGithubPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const db = getDb();

  const [profile, settings, linked] = await Promise.all([getProfile(db), getSiteSettings(db), listLinkedRepoNames(db)]);
  const username = profile?.githubUsername ?? null;

  // hasOwn keeps this a strict allow-list: ?notice=constructor must not find an inherited property.
  const notice = typeof query.notice === "string" && Object.hasOwn(NOTICES, query.notice) ? NOTICES[query.notice] : undefined;
  const synced = count(query.synced);
  const missing = count(query.missing);

  let repos: GithubRepo[] = [];
  let browseError: string | null = null;
  const browsing = query.browse === "1" && username !== null;
  if (browsing) {
    try {
      repos = await fetchPublicRepos(username, { token: process.env.GITHUB_TOKEN || undefined });
    } catch (error) {
      browseError = (error instanceof GithubError ? NOTICES[error.kind]?.text : undefined) ?? NOTICES.unavailable!.text;
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">GitHub</h1>
      <p className="mt-2 text-sm text-muted">
        Import your public repositories as projects, and keep stars, language and last update fresh. Only public data is read.
      </p>

      <div role="status" aria-live="polite" className="mt-6 text-sm">
        {notice && !notice.error ? <p>{notice.text}</p> : null}
        {synced !== null ? (
          <p>
            Updated {synced} {synced === 1 ? "project" : "projects"}.
            {missing
              ? ` ${missing} linked ${missing === 1 ? "project is" : "projects are"} no longer on your public GitHub and ${missing === 1 ? "was" : "were"} left unchanged.`
              : ""}
          </p>
        ) : null}
      </div>
      <div role="alert" className="text-sm text-danger">
        {notice?.error ? (
          <p>
            <span className="font-medium">Error: </span>
            {notice.text}
          </p>
        ) : null}
      </div>

      {!username ? (
        <p className="mt-6 text-sm">
          Add your GitHub username on the{" "}
          <Link href="/admin/profile" className="underline underline-offset-4">
            Profile page
          </Link>{" "}
          to use this.
        </p>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="sync-heading">
            <h2 id="sync-heading" className="text-lg font-semibold">
              Sync linked projects
            </h2>
            <p className="mt-1 text-sm text-muted">
              {linked.size} linked {linked.size === 1 ? "project" : "projects"}. Syncing updates only the numbers and dates that come from GitHub, never your titles or text.
            </p>
            <p className="mt-1 text-xs text-muted">
              {settings?.githubLastSyncAt ? `Last successful sync: ${formatMonth(settings.githubLastSyncAt)} (${settings.githubLastSyncAt.toISOString().slice(0, 16).replace("T", " ")} UTC).` : "Not synced yet."}
              {settings?.githubLastSyncError ? ` Last attempt failed: ${settings.githubLastSyncError}` : ""}
            </p>
            <form action={syncAction} className="mt-3">
              <Button type="submit" variant="secondary" disabled={linked.size === 0}>
                Sync now
              </Button>
            </form>
          </section>

          <section className="mt-10" aria-labelledby="browse-heading">
            <h2 id="browse-heading" className="text-lg font-semibold">
              Your repositories
            </h2>
            {!browsing ? (
              <>
                <p className="mt-1 text-sm text-muted">Loads the list of public repositories of @{username} from GitHub.</p>
                <div className="mt-3">
                  <ButtonLink href="/admin/github?browse=1" variant="secondary" prefetch={false}>
                    Load repositories
                  </ButtonLink>
                </div>
              </>
            ) : browseError ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                <span className="font-medium">Error: </span>
                {browseError}
              </p>
            ) : repos.length === 0 ? (
              <p className="mt-3 text-sm text-muted">@{username} has no public repositories.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-base border border-border">
                {repos.map((repo) => {
                  const projectId = linked.get(repo.fullName.toLowerCase());
                  return (
                    <li key={repo.fullName} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {repo.name}
                          {repo.fork ? <span className="ml-2 text-xs text-muted">Fork</span> : null}
                          {repo.archived ? <span className="ml-2 text-xs text-muted">Archived</span> : null}
                        </p>
                        {repo.description ? <p className="mt-1 text-sm text-muted">{repo.description}</p> : null}
                        <p className="mt-1 text-xs text-muted">
                          {[repo.language, `${repo.stars} stars`, `pushed ${formatMonth(repo.pushedAt)}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {projectId ? (
                        <Link
                          href={`/admin/projects/${projectId}`}
                          className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-text"
                          aria-label={`${repo.name} is already a project. Open it`}
                        >
                          Imported
                        </Link>
                      ) : (
                        <form action={importRepoAction}>
                          <input type="hidden" name="fullName" value={repo.fullName} />
                          <Button type="submit" variant="secondary" aria-label={`Import ${repo.name} as a draft project`}>
                            Import
                          </Button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
