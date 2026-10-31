import { z } from "zod";
import { checkbox, requiredText } from "@/features/shared/fields";
import { slugify } from "@/lib/slug";

export const TECHNOLOGY_CATEGORIES = ["LANGUAGE", "FRONTEND", "BACKEND", "DATABASE", "DEVOPS", "TOOL"] as const;

export const CATEGORY_LABELS: Record<(typeof TECHNOLOGY_CATEGORIES)[number], string> = {
  LANGUAGE: "Languages",
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  DATABASE: "Databases",
  DEVOPS: "DevOps",
  TOOL: "Tools",
};

export const technologySchema = z
  .object({
    name: requiredText(60),
    category: z.enum(TECHNOLOGY_CATEGORIES),
    isKeySkill: checkbox,
  })
  .transform((value) => ({ ...value, slug: slugify(value.name) }))
  .refine((value) => value.slug.length > 0, { path: ["name"], message: "Use letters or digits in the name" });

export type TechnologyData = z.output<typeof technologySchema>;
