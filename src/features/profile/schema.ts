import { z } from "zod";
import { optionalAssetUrl, optionalHttpUrl, optionalText } from "@/features/shared/fields";

const githubUsername = optionalText(39).refine((value) => value === null || /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(value), {
  message: "Letters, digits and hyphens only",
});

const contactEmail = optionalText(254).refine((value) => value === null || z.email().safeParse(value).success, {
  message: "Must be a valid email address",
});

/** One form edits both single-row tables; the schema splits them again. */
export const profileFormSchema = z
  .object({
    fullName: optionalText(120),
    headline: optionalText(160),
    location: optionalText(120),
    statement: optionalText(400),
    bio: optionalText(5000),
    contactEmail,
    githubUsername,
    linkedinUrl: optionalHttpUrl,
    xUrl: optionalHttpUrl,
    websiteUrl: optionalHttpUrl,
    cvUrl: optionalAssetUrl,
    avatarUrl: optionalAssetUrl,
    siteTitle: optionalText(120),
    siteDescription: optionalText(300),
  })
  .transform(({ siteTitle, siteDescription, ...profile }) => ({
    profile,
    settings: { siteTitle, siteDescription },
  }));

export type ProfileFormData = z.output<typeof profileFormSchema>;
