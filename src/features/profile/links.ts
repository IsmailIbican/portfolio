import { z } from "zod";
import type { Profile } from "@/generated/prisma/client";
import { isHttpUrl } from "@/lib/url";

export interface SocialLink {
  label: string;
  href: string;
}

/** Public links built from the profile. Everything is re-checked at render time as defense in depth. */
export function getSocialLinks(profile: Profile | null): SocialLink[] {
  if (!profile) return [];
  const links: SocialLink[] = [];
  if (profile.githubUsername) links.push({ label: "GitHub", href: `https://github.com/${encodeURIComponent(profile.githubUsername)}` });
  if (profile.linkedinUrl) links.push({ label: "LinkedIn", href: profile.linkedinUrl });
  if (profile.xUrl) links.push({ label: "X", href: profile.xUrl });
  if (profile.websiteUrl) links.push({ label: "Website", href: profile.websiteUrl });
  return links.filter((link) => isHttpUrl(link.href));
}

/** mailto: link for the public contact email, re-validated at render. Null when missing or malformed. */
export function getContactMailto(profile: Pick<Profile, "contactEmail"> | null): string | null {
  const email = profile?.contactEmail;
  if (!email || !z.email().safeParse(email).success) return null;
  const at = email.lastIndexOf("@");
  return `mailto:${encodeURIComponent(email.slice(0, at))}@${email.slice(at + 1)}`;
}

export function splitParagraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
