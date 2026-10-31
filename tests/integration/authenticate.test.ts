// @vitest-environment node
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { authenticate, LOCKOUT_MS, MAX_FAILED_LOGINS } from "@/features/auth/login";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const EMAIL = "admin@example.com";
const PASSWORD = "correct-horse-battery";
const creds = (password: string) => ({ email: EMAIL, password });

let passwordHash = "";

beforeAll(async () => {
  passwordHash = await hash(PASSWORD);
});

beforeEach(async () => {
  await prisma.adminUser.deleteMany();
  await prisma.adminUser.create({ data: { email: EMAIL, passwordHash } });
});

afterAll(async () => {
  await prisma.adminUser.deleteMany();
  await prisma.$disconnect();
});

describe("authenticate", () => {
  it("accepts the correct password and records the login", async () => {
    const result = await authenticate(prisma, creds(PASSWORD));
    expect(result.ok).toBe(true);
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.lastLoginAt).not.toBeNull();
    expect(user.failedLoginCount).toBe(0);
  });

  it("rejects a wrong password and counts the failure", async () => {
    expect((await authenticate(prisma, creds("wrong"))).ok).toBe(false);
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.failedLoginCount).toBe(1);
  });

  it("rejects an unknown email", async () => {
    expect((await authenticate(prisma, { email: "nobody@example.com", password: PASSWORD })).ok).toBe(false);
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    const now = new Date();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await authenticate(prisma, creds("wrong"), now);

    const locked = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(locked.lockedUntil).not.toBeNull();
    expect((await authenticate(prisma, creds(PASSWORD), now)).ok).toBe(false);
  });

  it("allows login again once the lockout has expired", async () => {
    const now = new Date();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await authenticate(prisma, creds("wrong"), now);

    const later = new Date(now.getTime() + LOCKOUT_MS + 1000);
    expect((await authenticate(prisma, creds(PASSWORD), later)).ok).toBe(true);
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.lockedUntil).toBeNull();
  });

  it("cannot be brute-forced with parallel requests", async () => {
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 25 }, () => authenticate(prisma, creds("wrong"), now)));
    expect(results.every((result) => !result.ok)).toBe(true);

    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    // Only MAX_FAILED_LOGINS attempts could reserve a verification slot; the rest were refused.
    expect(user.failedLoginCount).toBe(MAX_FAILED_LOGINS);
    expect(user.lockedUntil).not.toBeNull();
    expect((await authenticate(prisma, creds(PASSWORD), now)).ok).toBe(false);
  });

  it("returns the session version on success", async () => {
    const result = await authenticate(prisma, creds(PASSWORD));
    expect(result.ok && result.user.sessionVersion).toBe(0);
  });

  it("resets the failure counter after a successful login", async () => {
    await authenticate(prisma, creds("wrong"));
    await authenticate(prisma, creds(PASSWORD));
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.failedLoginCount).toBe(0);
  });
});
