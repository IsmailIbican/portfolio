import { z } from "zod";
import { optionalMonth, optionalText, publishStatus, requiredMonth, requiredText } from "@/features/shared/fields";

export const experienceSchema = z
  .object({
    company: requiredText(120),
    role: requiredText(120),
    location: optionalText(120),
    startDate: requiredMonth,
    endDate: optionalMonth,
    description: requiredText(5000),
    status: publishStatus,
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End must not be before start",
  });

export type ExperienceData = z.output<typeof experienceSchema>;
