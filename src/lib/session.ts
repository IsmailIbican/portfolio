import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSessionValid } from "@/features/auth/session-check";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** The signed-in admin, or null. Never redirects, so route handlers can answer 401 themselves. */
export const getAdmin = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await getDb().adminUser.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, sessionVersion: true },
  });
  if (
    !user ||
    !isSessionValid({
      tokenVersion: session.sessionVersion,
      loginAt: session.loginAt,
      dbVersion: user.sessionVersion,
      role: user.role,
    })
  ) {
    return null;
  }
  return { id: user.id, email: user.email };
});

/**
 * Authoritative admin check for pages, layouts and server actions: verifies the session against the database
 * (user exists, is an admin, session not revoked or expired). The proxy only does an optimistic cookie check.
 *
 * Every server action and route handler must call this (or getAdmin) itself; layout checks do not cover them.
 */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
