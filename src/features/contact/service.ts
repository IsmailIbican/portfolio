import type { ContactStatus, PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db-errors";
import type { ContactInput } from "./schema";

export const LIMIT_PER_IP = 5;
export const LIMIT_TOTAL = 60;
export const WINDOW_MS = 60 * 60 * 1000;

/** Arbitrary constant: every contact submission takes this advisory lock so check-and-insert cannot interleave. */
const SUBMIT_LOCK_KEY = 727_001;

type ContactDb = Pick<PrismaClient, "contactSubmission">;

/**
 * Per-visitor and overall limits, counted from the stored messages themselves (no extra table, and it works on
 * serverless where memory is not shared). Without a trusted visitor address (ipHash null) only the overall cap applies.
 */
export async function isRateLimited(db: ContactDb, ipHash: string | null, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const [fromVisitor, total] = await Promise.all([
    ipHash ? db.contactSubmission.count({ where: { ipHash, createdAt: { gte: since } } }) : Promise.resolve(0),
    db.contactSubmission.count({ where: { createdAt: { gte: since } } }),
  ]);
  return fromVisitor >= LIMIT_PER_IP || total >= LIMIT_TOTAL;
}

export type SubmitOutcome = "saved" | "rate-limited" | "duplicate";

/**
 * Saves a message, atomically:
 * - one advisory lock serialises submissions, so a burst of parallel requests cannot all pass the limit check
 *   before any of them has been stored (contact traffic is tiny, so one global lock costs nothing);
 * - the form token's hash is stored under a unique index, so a token works once ("duplicate" otherwise);
 * - visitor hashes older than the rate-limit window are erased, so they are not kept longer than they are useful.
 */
export async function submitMessage(
  db: PrismaClient,
  input: ContactInput,
  { ipHash, formTokenHash, now = new Date() }: { ipHash: string | null; formTokenHash: string; now?: Date },
): Promise<SubmitOutcome> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUBMIT_LOCK_KEY})`;

      if (await isRateLimited(tx, ipHash, now)) return "rate-limited";

      await tx.contactSubmission.updateMany({
        where: { ipHash: { not: null }, createdAt: { lt: new Date(now.getTime() - WINDOW_MS) } },
        data: { ipHash: null },
      });
      await tx.contactSubmission.create({
        // createdAt uses the same clock as the rate-limit window, so the two can never disagree.
        data: { name: input.name, email: input.email, message: input.message, ipHash, formTokenHash, createdAt: now },
      });
      return "saved";
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}

/** Plain insert, for fixtures and tests. The public form goes through submitMessage. */
export function createSubmission(db: ContactDb, input: ContactInput, ipHash: string | null, createdAt?: Date) {
  return db.contactSubmission.create({ data: { name: input.name, email: input.email, message: input.message, ipHash, createdAt } });
}

export function listSubmissions(db: PrismaClient, status?: ContactStatus) {
  return db.contactSubmission.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, take: 200 });
}

export function countByStatus(db: PrismaClient) {
  return db.contactSubmission.groupBy({ by: ["status"], _count: { _all: true } });
}

export function setSubmissionStatus(db: PrismaClient, id: string, status: ContactStatus) {
  return db.contactSubmission.update({ where: { id }, data: { status } });
}

export function deleteSubmission(db: PrismaClient, id: string) {
  return db.contactSubmission.delete({ where: { id } });
}
