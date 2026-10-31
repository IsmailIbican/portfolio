import type { Metadata } from "next";
import { ProfilePhoto } from "@/components/portfolio/profile-photo";
import { Reveal } from "@/components/portfolio/reveal";
import { listPublishedEducation } from "@/features/education/service";
import { listPublishedExperience } from "@/features/experience/service";
import { getSocialLinks, splitParagraphs } from "@/features/profile/links";
import { getProfile } from "@/features/profile/service";
import { formatRange } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { isHostedImageUrl } from "@/lib/image-url";
import { isHttpUrlOrSitePath } from "@/lib/url";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const db = getDb();
  const [profile, experience, education] = await Promise.all([
    getProfile(db),
    listPublishedExperience(db),
    listPublishedEducation(db),
  ]);

  const paragraphs = splitParagraphs(profile?.bio);
  const links = getSocialLinks(profile);
  const cvUrl = profile?.cvUrl && isHttpUrlOrSitePath(profile.cvUrl) ? profile.cvUrl : null;
  const photoUrl = profile?.avatarUrl && isHostedImageUrl(profile.avatarUrl) ? profile.avatarUrl : null;
  const empty = paragraphs.length === 0 && experience.length === 0 && education.length === 0;

  return (
    <div className="max-w-(--container-prose) pt-16 sm:pt-24">
      <div className="flex items-center gap-5">
        {photoUrl ? <ProfilePhoto src={photoUrl} name={profile?.fullName} /> : null}
        <h1 className="hero-in text-3xl font-semibold tracking-tight sm:text-4xl">About</h1>
      </div>

      {empty ? <p className="mt-6 text-muted">Nothing here yet.</p> : null}

      {paragraphs.length > 0 ? (
        <div className="hero-in mt-8 space-y-4 leading-relaxed" style={{ "--i": 1 } as React.CSSProperties}>
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {cvUrl || links.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-x-5 text-sm">
          {cvUrl ? (
            <li>
              <a href={cvUrl} className="inline-flex min-h-11 items-center underline underline-offset-4">
                Download CV
              </a>
            </li>
          ) : null}
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 transition-colors duration-(--duration-hover) hover:text-text"
              >
                {link.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {experience.length > 0 ? (
        <Reveal immediate={paragraphs.length === 0} className="mt-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Experience</h2>
          <ol className="mt-6 space-y-8">
            {experience.map((item) => (
              <li key={item.id}>
                <h3 className="font-medium">
                  {item.role} · {item.company}
                </h3>
                <p className="text-sm text-muted">
                  {formatRange(item.startDate, item.endDate)}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{item.description}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      ) : null}

      {education.length > 0 ? (
        <Reveal className="mt-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Education</h2>
          <ol className="mt-6 space-y-6">
            {education.map((item) => (
              <li key={item.id}>
                <h3 className="font-medium">
                  {item.degree}
                  {item.field ? `, ${item.field}` : ""} · {item.institution}
                </h3>
                <p className="text-sm text-muted">{formatRange(item.startDate, item.endDate)}</p>
                {item.description ? <p className="mt-2 whitespace-pre-line leading-relaxed">{item.description}</p> : null}
              </li>
            ))}
          </ol>
        </Reveal>
      ) : null}
    </div>
  );
}
