import { config } from "dotenv";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

/**
 * Idempotent bootstrap seed. It never invents portfolio content:
 * - creates the empty singleton rows (Profile, SiteSettings) so the admin can fill them in
 * - creates the first admin only when ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD are set,
 *   and never overwrites an existing admin's password.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    await prisma.siteSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!email || !password) {
      console.log("ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set: skipped admin creation.");
      return;
    }
    if (password.length < 12) throw new Error("ADMIN_INITIAL_PASSWORD must be at least 12 characters.");

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      console.log("Admin already exists: left unchanged.");
      return;
    }
    await prisma.adminUser.create({ data: { email, passwordHash: await hash(password) } });
    console.log("Created admin.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
