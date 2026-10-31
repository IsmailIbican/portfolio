import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // Upper bound keeps hashing cost bounded for oversized inputs.
  password: z.string().min(1).max(200),
});

export type Credentials = z.infer<typeof credentialsSchema>;
