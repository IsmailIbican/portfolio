import { z } from "zod";
import { parseMonth } from "@/lib/dates";
import { isHttpUrl, isHttpUrlOrSitePath } from "@/lib/url";

/** Trimmed optional text; empty or missing becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((value) => (value ? value : null));

export const requiredText = (max: number) =>
  z.string().trim().min(1, "Required").max(max, `At most ${max} characters`);

export const optionalHttpUrl = optionalText(2048).refine((value) => value === null || isHttpUrl(value), {
  message: "Must be a valid http(s) URL",
});

export const optionalAssetUrl = optionalText(2048).refine((value) => value === null || isHttpUrlOrSitePath(value), {
  message: "Must be an http(s) URL or a site path starting with /",
});

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const requiredMonth = z
  .string()
  .regex(MONTH, "Use YYYY-MM")
  .transform((value) => parseMonth(value));

export const optionalMonth = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || MONTH.test(value), { message: "Use YYYY-MM" })
  .transform((value) => (value ? parseMonth(value) : null));

export const publishStatus = z.enum(["DRAFT", "PUBLISHED"]);

/** An <input type="checkbox"> posts "on" when checked and nothing otherwise. */
export const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

export const recordId = z.string().trim().min(1).max(64);
