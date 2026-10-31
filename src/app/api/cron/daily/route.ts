import { NextResponse } from "next/server";
import { syncFromGithub } from "@/features/github/service";
import { deleteOldMessages, sweepOrphanedUploads } from "@/features/maintenance/service";
import { getProfile } from "@/features/profile/service";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getDb } from "@/lib/db";
import { revalidatePublic } from "@/lib/revalidate";
import { getStorage } from "@/lib/storage";

// Three independent steps run side by side; the slowest is the GitHub request. Generous, but not unbounded.
export const maxDuration = 60;

type StepResult = { ok: true; detail: Record<string, number> } | { ok: false };

const fail = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

/** One failing step must not stop the others; the reason goes to the server log, never to the response. */
async function step(name: string, run: () => Promise<Record<string, number>>): Promise<StepResult> {
  try {
    return { ok: true, detail: await run() };
  } catch (error) {
    console.error(`cron: step "${name}" failed`, error);
    return { ok: false };
  }
}

/**
 * Daily maintenance, called by Vercel Cron (vercel.json). Not an admin route: it is protected by CRON_SECRET, which
 * Vercel sends as a bearer token. Without the secret configured the route refuses every request.
 * If any step fails the response is 500 (after all steps ran), so Vercel shows the invocation as failed.
 * It changes data on GET because Vercel Cron can only send GET. That is acceptable only because the bearer token
 * cannot be sent by a browser across sites; do not copy this pattern to routes that rely on cookies.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail(503, "not_configured", "Cron is not configured.");
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) return fail(401, "unauthorized", "Unauthorized.");

  const [messages, uploads, github] = await Promise.all([
    step("messages", async () => ({ deleted: await deleteOldMessages(getDb()) })),
    step("uploads", async (): Promise<Record<string, number>> => {
      // The Blob store is shared by every environment but the "referenced" list comes from this deployment's database.
      // A preview or local run with its own (empty) database would see production files as orphans and delete them.
      if (process.env.VERCEL_ENV !== "production") return { skipped: 1 };
      return { ...(await sweepOrphanedUploads(getDb(), getStorage())) };
    }),
    step("github", async (): Promise<Record<string, number>> => {
      const db = getDb();
      const username = (await getProfile(db))?.githubUsername;
      if (!username) return { skipped: 1 };
      const summary = await syncFromGithub(db, username, { token: process.env.GITHUB_TOKEN || undefined });
      revalidatePublic();
      return { updated: summary.updated, missing: summary.missing.length };
    }),
  ]);

  const allOk = messages.ok && uploads.ok && github.ok;
  return NextResponse.json({ messages, uploads, github }, { status: allOk ? 200 : 500 });
}
