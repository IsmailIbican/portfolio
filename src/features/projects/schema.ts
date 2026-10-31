import { z } from "zod";
import { checkbox, optionalHttpUrl, optionalText, publishStatus, recordId, requiredText } from "@/features/shared/fields";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalSlug = optionalText(80).refine((value) => value === null || SLUG.test(value), {
  message: "Lowercase letters, digits and single hyphens only",
});

const sortOrder = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : 0))
  .pipe(z.number().int("Whole number").min(-1000).max(1000));

export const projectSchema = z.object({
  title: requiredText(120),
  slug: optionalSlug,
  summary: requiredText(300),
  overview: optionalText(5000),
  problem: optionalText(5000),
  solution: optionalText(5000),
  architecture: optionalText(5000),
  implementation: optionalText(5000),
  challenges: optionalText(5000),
  results: optionalText(5000),
  repoUrl: optionalHttpUrl,
  liveUrl: optionalHttpUrl,
  status: publishStatus,
  featured: checkbox,
  sortOrder,
  // A repeated id (tampered or double-posted form) would violate the link table's unique key, so duplicates are dropped.
  technologyIds: z
    .array(recordId)
    .max(60)
    .transform((ids) => [...new Set(ids)]),
});

export type ProjectData = z.output<typeof projectSchema>;

/** FormData repeats keys for checkbox groups; Object.fromEntries would keep only the last one. */
export function projectFormInput(formData: FormData): Record<string, unknown> {
  return { ...Object.fromEntries(formData), technologyIds: formData.getAll("technologyIds").map(String) };
}

export const mediaAltSchema = z.string().trim().min(1, "Describe the image").max(200, "At most 200 characters");
