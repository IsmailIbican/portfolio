import Link from "next/link";
import { ProjectCard } from "@/components/portfolio/project-card";
import { Reveal } from "@/components/portfolio/reveal";
import { ButtonLink } from "@/components/ui/button-link";
import { listPublishedExperience } from "@/features/experience/service";
import { listFeaturedProjects } from "@/features/projects/service";
import { getProfile } from "@/features/profile/service";
import { listKeySkills } from "@/features/technologies/service";
import { formatRange } from "@/lib/dates";
import { getDb } from "@/lib/db";

const textLink = "inline-flex min-h-11 items-center underline underline-offset-4 text-muted transition-colors duration-(--duration-hover) hover:text-text";

export default async function HomePage() {
  const db = getDb();
  const [profile, skills, experience, featuredProjects] = await Promise.all([
    getProfile(db),
    listKeySkills(db),
    listPublishedExperience(db, 3),
    listFeaturedProjects(db, 3),
  ]);

  const hasHero = Boolean(profile?.fullName || profile?.headline);
  const hasContent = hasHero || skills.length > 0 || experience.length > 0 || featuredProjects.length > 0;
  if (!hasContent) {
    return (
      <section className="max-w-(--container-prose) pt-24 sm:pt-32">
        <h1 className="hero-in text-3xl font-semibold tracking-tight">Coming soon</h1>
        <p className="hero-in mt-4 text-muted" style={{ "--i": 1 } as React.CSSProperties}>
          This portfolio is being set up.
        </p>
      </section>
    );
  }

  return (
    <>
      {/* Without a name or headline there is no hero, but the page still needs exactly one h1. */}
      {hasHero ? null : <h1 className="sr-only">Portfolio</h1>}
      <section className={hasHero ? "max-w-(--container-prose) pt-24 sm:pt-32" : "hidden"}>
        {/* Always one h1: the name when set, otherwise the headline. */}
        {profile?.fullName ? (
          <h1 className="hero-in text-4xl font-semibold tracking-tight sm:text-5xl">{profile.fullName}</h1>
        ) : null}
        {profile?.headline ? (
          profile.fullName ? (
            <p className="hero-in mt-4 text-xl text-muted" style={{ "--i": 1 } as React.CSSProperties}>
              {profile.headline}
            </p>
          ) : (
            <h1 className="hero-in text-4xl font-semibold tracking-tight sm:text-5xl">{profile.headline}</h1>
          )
        ) : null}
        {profile?.statement ? (
          <p className="hero-in mt-6 leading-relaxed" style={{ "--i": 2 } as React.CSSProperties}>
            {profile.statement}
          </p>
        ) : null}
        <div className="hero-in mt-8 flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
          <ButtonLink href="/about">About me</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Get in touch
          </ButtonLink>
        </div>
      </section>

      {featuredProjects.length > 0 ? (
        // First content under the hero: on a phone it is on screen at load, so it must not wait for JavaScript.
        <Reveal immediate className={hasHero ? "mt-24" : "pt-16 sm:pt-24"}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Featured projects</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project, index) => (
              <li key={project.id}>
                <ProjectCard project={project} eager={index === 0} />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm">
            <Link href="/projects" className={textLink}>
              All projects
            </Link>
          </p>
        </Reveal>
      ) : null}

      {skills.length > 0 ? (
        <Reveal className="mt-20 max-w-(--container-prose)">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Key skills</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill.id} className="rounded-base border border-border px-3 py-1 font-mono text-sm">
                {skill.name}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/tech-stack" className={textLink}>
              Full tech stack
            </Link>
          </p>
        </Reveal>
      ) : null}

      {experience.length > 0 ? (
        <Reveal className="mt-20 max-w-(--container-prose)">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Selected experience</h2>
          <ol className="mt-4 space-y-6">
            {experience.map((item) => (
              <li key={item.id}>
                <p className="font-medium">
                  {item.role} · {item.company}
                </p>
                <p className="text-sm text-muted">{formatRange(item.startDate, item.endDate)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm">
            <Link href="/about" className={textLink}>
              Full background
            </Link>
          </p>
        </Reveal>
      ) : null}
    </>
  );
}
