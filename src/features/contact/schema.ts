import { z } from "zod";

// Built from numeric code points on purpose: the characters themselves are invisible and easy to corrupt.
const range = (from: number, to: number) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`;

// Blocked in a name: control characters (incl. line breaks), the line/paragraph separators (U+2028, U+2029) and the
// bidirectional overrides/isolates (U+202A-202E, U+2066-2069), which can make a name read backwards in the
// notification subject or the admin list. Zero-width joiners stay allowed: several scripts need them for ordinary names.
const UNSAFE_IN_NAME = new RegExp(
  `[\\p{Cc}${String.fromCodePoint(0x2028)}${String.fromCodePoint(0x2029)}${range(0x202a, 0x202e)}${range(0x2066, 0x2069)}]`,
  "u",
);

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100, "At most 100 characters").refine((value) => !UNSAFE_IN_NAME.test(value), "Remove special characters"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(5000, "At most 5000 characters"),
});

export type ContactInput = z.output<typeof contactSchema>;
