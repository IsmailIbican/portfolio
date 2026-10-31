"use server";

import { getDb } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";

export async function logoutAction() {
  const user = await requireAdmin();
  // Invalidate every session issued so far, so a copied cookie stops working too.
  await getDb().adminUser.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await signOut({ redirectTo: "/admin/login" });
}
