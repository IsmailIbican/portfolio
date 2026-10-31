import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GithubMeta } from "@/components/portfolio/github-meta";
import { ProjectCard } from "@/components/portfolio/project-card";
import { Reveal } from "@/components/portfolio/reveal";
import { getSiteSettings } from "@/features/profile/service";
import { getPublishedProjectBySlug, listRelatedProjects } from "@/features/projects/service";
import { getDb } from "@/lib/db";
import { isHttpUrl } from "@/lib/url";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const [project, settings] = await Promise.all([getPublishedProjectBySlug(db, slug), getSiteSettings(db)]);
  if (!project) return { title: "Project not found", robots: { index: false } };

  // A page's openGraph/twitter objects replace the ones from the root layout instead of merging with them,
  // so everything that should still be there (site name, locale, card type) is stated again.
  return {
    title: project.title,
    description: project.summary,
    openGraph: {
      type: "article",
      siteName: settings?.siteTitle ?? "Portfolio",
      locale: "en_US",
      title: project.title,
      description: project.summary,
      publishedTime: project.publishedAt?.toISOString(),
    },
    twitter: { card: "summary_large_image", title: project.title, description: project.summary },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const db = getDb();
  const project = await getPublishedProjectBySlug(db, slug);
  if (!project) notFound();

  const related = await listRelatedProjects(db, {
    id: project.id,
    technologyIds: project.technologies.map((link) => link.technologyId),
  });

  const sections = [
    { title: "Overview", text: project.overview },
    { title: "Problem", text: project.problem },
    { title: "Solution", text: project.solution },
    { title: "Technical architecture", text: project.architecture },
    { title: "Implementation", text: project.implementation },
    { title: "Challenges", text: project.challenges },
    { title: "Results", text: project.results },
  ].filter((section) => section.text);

  const links = [
    project.repoUrl && isHttpUrl(project.repoUrl) ? { label: "Source code", href: project.repoUrl } : null,
    project.liveUrl && isHttpUrl(project.liveUrl) ? { label: "Live demo", href: project.liveUrl } : null,
  ].filter((link) => link !== null);

  return (
    <div className="pt-16 sm:pt-24">
    <article>
      <div className="max-w-(--container-prose)">
        <Link
          href="/projects"
          className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 transition-colors duration-(--duration-hover) hover:text-text"
        >
          All projects
        </Link>
        <h1 className="hero-in mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{project.title}</h1>
        <p className="hero-in mt-4 text-lg text-muted" style={{ "--i": 1 } as React.CSSProperties}>
          {project.summary}
        </p>

        <GithubMeta {...project} className="hero-in mt-4 text-sm text-muted" />

        {links.length > 0 ? (
          <ul className="hero-in mt-6 flex flex-wrap gap-x-5" style={{ "--i": 2 } as React.CSSProperties}>
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                >
                  {link.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {project.technologies.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-2" aria-label="Technologies">
            {project.technologies.map((link) => (
              <li key={link.technologyId}>
                <Link
                  href={`/projects?tech=${link.technology.slug}`}
                  className="inline-flex min-h-11 items-center px-3 font-mono text-xs text-muted underline underline-offset-4 transition-colors duration-(--duration-hover) hover:text-text"
                >
                  {link.technology.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {project.media.length > 0 ? (
        <ul className="mt-12 grid max-w-(--container-wide) gap-5 sm:grid-cols-2">
          {project.media.map((item, index) => (
            <li key={item.id} className={index === 0 && project.media.length % 2 === 1 ? "sm:col-span-2" : undefined}>
              <div className="relative aspect-video overflow-hidden rounded-base border border-border bg-surface">
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  sizes={index === 0 && project.media.length % 2 === 1 ? "(min-width: 1100px) 1100px, 100vw" : "(min-width: 1100px) 540px, 100vw"}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {sections.length > 0 ? (
        <div className="mt-12 max-w-(--container-prose) space-y-10">
          {sections.map((section) => (
            <Reveal key={section.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed">{section.text}</p>
            </Reveal>
          ))}
        </div>
      ) : null}

    </article>

    {/* Outside the <article>: each related card is its own article, not a part of this one. */}
    {related.length > 0 ? (
      <Reveal className="mt-20">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Related projects</h2>
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <li key={item.id}>
              <ProjectCard project={item} />
            </li>
          ))}
        </ul>
      </Reveal>
    ) : null}
    </div>
  );
}
