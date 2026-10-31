import { z } from "zod";
import { optionalMonth, optionalText, publishStatus, requiredMonth, requiredText } from "@/features/shared/fields";

export const educationSchema = z
  .object({
    institution: requiredText(160),
    degree: requiredText(120),
    field: optionalText(120),
    startDate: requiredMonth,
    endDate: optionalMonth,
    description: optionalText(2000),
    status: publishStatus,
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End must not be before start",
  });

export type EducationData = z.output<typeof educationSchema>;
