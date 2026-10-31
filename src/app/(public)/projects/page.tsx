import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/portfolio/project-card";
import { Reveal } from "@/components/portfolio/reveal";
import { listFilterTechnologies, listPublishedProjects } from "@/features/projects/service";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Projects" };

const TECH_SLUG = /^[a-z0-9-]{1,60}$/;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ tech?: string | string[] }> }) {
  const { tech } = await searchParams;
  const requested = typeof tech === "string" && TECH_SLUG.test(tech) ? tech : undefined;

  const db = getDb();
  const [projects, filters] = await Promise.all([
    listPublishedProjects(db, { technologySlug: requested }),
    listFilterTechnologies(db),
  ]);

  const activeFilter = filters.find((item) => item.slug === requested);
  const featured = requested ? [] : projects.filter((project) => project.featured);
  const rest = requested ? projects : projects.filter((project) => !project.featured);

  return (
    <div className="pt-16 sm:pt-24">
      <h1 className="hero-in text-3xl font-semibold tracking-tight sm:text-4xl">Projects</h1>

      {filters.length > 0 ? (
        <nav aria-label="Filter by technology" className="mt-8">
          {/* One scrollable row on phones: how many rows chips wrap into depends on text width, so wrapping them made
              the page jump whenever the web font finished loading. From sm up there is room, and they wrap. */}
          <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <li className="shrink-0">
              <FilterLink href="/projects" active={!activeFilter}>
                All
              </FilterLink>
            </li>
            {filters.map((item) => (
              <li key={item.id} className="shrink-0">
                <FilterLink href={`/projects?tech=${item.slug}`} active={item.slug === activeFilter?.slug}>
                  {item.name}
                </FilterLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {projects.length === 0 ? (
        <p className="mt-10 text-muted">{activeFilter ? "No projects use this technology yet." : "Nothing here yet."}</p>
      ) : null}

      {featured.length > 0 ? (
        <Reveal immediate className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Featured</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((project, index) => (
              <li key={project.id}>
                <ProjectCard project={project} eager={index === 0} />
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      {rest.length > 0 ? (
        // Immediate only when it is the first section; otherwise it sits below the featured block.
        <Reveal immediate={featured.length === 0} className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            {requested ? `Built with ${activeFilter?.name ?? "this technology"}` : "All projects"}
          </h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((project, index) => (
              <li key={project.id}>
                {/* The first card of the page is "eager"; when there are featured projects they come first. */}
                <ProjectCard project={project} eager={featured.length === 0 && index === 0} />
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-base border px-3 text-sm transition-colors duration-(--duration-hover)",
        active ? "border-text font-medium text-text" : "border-border text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {children}
    </Link>
  );
}
