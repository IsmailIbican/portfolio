import Image from "next/image";
import Link from "next/link";
import type { listPublishedProjects } from "@/features/projects/service";
import { GithubMeta } from "./github-meta";

type PublicProject = Awaited<ReturnType<typeof listPublishedProjects>>[number];

const MAX_TAGS = 4;

/**
 * Whole card is one link (via the title's stretched ::after), so there is a single tab stop per project.
 * `eager` is for the first card on a page, whose image is usually the largest thing on screen (the LCP):
 * it is loaded straight away with high priority instead of lazily.
 */
export function ProjectCard({ project, eager = false }: { project: PublicProject; eager?: boolean }) {
  const cover = project.media[0];
  const tags = project.technologies.slice(0, MAX_TAGS);
  const extra = project.technologies.length - tags.length;

  return (
    <article
      // Tailwind v4 lifts with the standalone `translate` property, so both the transition and the
      // reduced-motion override must name `translate` (not `transform`).
      className={[
        "relative flex flex-col rounded-base border border-border bg-surface p-3",
        "transition-[translate,border-color] duration-(--duration-hover) ease-(--ease-out)",
        "hover:-translate-y-0.5 hover:border-border-strong motion-reduce:hover:translate-y-0",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
      ].join(" ")}
    >
      <div className="relative aspect-video overflow-hidden rounded-base border border-border bg-bg">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 100vw"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            className="object-cover"
          />
        ) : null}
      </div>
      <h3 className="mt-4 font-medium">
        <Link href={`/projects/${project.slug}`} className="outline-none after:absolute after:inset-0">
          {project.title}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-muted">{project.summary}</p>
      <GithubMeta {...project} className="mt-2 text-xs text-muted" />
      {tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Technologies">
          {tags.map((link) => (
            <li key={link.technologyId} className="rounded-base border border-border px-2 py-0.5 font-mono text-xs text-muted">
              {link.technology.name}
            </li>
          ))}
          {extra > 0 ? <li className="px-1 py-0.5 text-xs text-muted">+{extra}</li> : null}
        </ul>
      ) : null}
    </article>
  );
}
