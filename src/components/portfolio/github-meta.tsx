import { formatMonth } from "@/lib/dates";

interface GithubMetaProps {
  githubRepo: string | null;
  githubStars: number | null;
  githubLanguage: string | null;
  githubPushedAt: Date | null;
  className?: string;
}

/** One quiet line of GitHub facts for projects linked to a repository. Renders nothing for manual projects. */
export function GithubMeta({ githubRepo, githubStars, githubLanguage, githubPushedAt, className }: GithubMetaProps) {
  if (!githubRepo) return null;

  const parts = [
    githubLanguage,
    githubStars !== null ? (
      <span key="stars">
        {githubStars} <span aria-hidden="true">★</span>
        <span className="sr-only">stars</span>
      </span>
    ) : null,
    githubPushedAt ? `Updated ${formatMonth(githubPushedAt)}` : null,
  ].filter((part) => part !== null);

  if (parts.length === 0) return null;

  return (
    <p className={className ?? "text-xs text-muted"}>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}
