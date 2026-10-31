import { hash, verify } from "@node-rs/argon2";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Credentials } from "./schema";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export type AuthResult =
  | { ok: true; user: { id: string; email: string; sessionVersion: number } }
  | { ok: false };

/** Verified against when the account is missing or locked, so response time does not reveal either. */
const dummyHash = hash("not-a-real-password");

async function failAfterDummyVerify(password: string): Promise<AuthResult> {
  await verify(await dummyHash, password).catch(() => false);
  return { ok: false };
}

/**
 * Checks credentials against AdminUser. Callers get one generic failure for every reason
 * (unknown email, wrong password, temporarily locked) so nothing about accounts leaks.
 *
 * The attempt budget is reserved with a single conditional UPDATE *before* the password is
 * verified, so parallel requests cannot all slip past the limit.
 */
export async function authenticate(
  db: PrismaClient,
  { email, password }: Credentials,
  now: Date = new Date(),
): Promise<AuthResult> {
  const user = await db.adminUser.findUnique({ where: { email }, select: { id: true } });
  if (!user) return failAfterDummyVerify(password);

  // Clear an expired lock (idempotent, safe to run concurrently).
  await db.adminUser.updateMany({
    where: { id: user.id, lockedUntil: { lte: now } },
    data: { lockedUntil: null, failedLoginCount: 0 },
  });

  // Reserve one attempt. Matches only while unlocked and under the limit.
  const reserved = await db.adminUser.updateMany({
    where: { id: user.id, lockedUntil: null, failedLoginCount: { lt: MAX_FAILED_LOGINS } },
    data: { failedLoginCount: { increment: 1 } },
  });
  if (reserved.count === 0) return failAfterDummyVerify(password);

  const account = await db.adminUser.findUniqueOrThrow({ where: { id: user.id } });
  const valid = await verify(account.passwordHash, password).catch(() => false);

  if (!valid) {
    // The attempt that exhausts the budget starts the lock; the guard keeps this idempotent.
    await db.adminUser.updateMany({
      where: { id: user.id, lockedUntil: null, failedLoginCount: { gte: MAX_FAILED_LOGINS } },
      data: { lockedUntil: new Date(now.getTime() + LOCKOUT_MS) },
    });
    return { ok: false };
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });
  return { ok: true, user: { id: account.id, email: account.email, sessionVersion: account.sessionVersion } };
}
