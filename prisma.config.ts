import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Local values live in .env.local (Next.js convention); .env is an optional fallback.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
