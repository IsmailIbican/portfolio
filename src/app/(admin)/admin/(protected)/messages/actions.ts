"use server";

import { revalidatePath } from "next/cache";
import { deleteSubmission, setSubmissionStatus } from "@/features/contact/service";
import { recordId } from "@/features/shared/fields";
import { getDb } from "@/lib/db";
import { isRecordNotFound } from "@/lib/db-errors";
import { requireAdmin } from "@/lib/session";
import { z } from "zod";

const status = z.enum(["NEW", "READ", "ARCHIVED"]);

export async function setMessageStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  const next = status.safeParse(formData.get("status"));
  if (!id.success || !next.success) return;

  try {
    await setSubmissionStatus(getDb(), id.data, next.data);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePath("/admin", "layout");
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await deleteSubmission(getDb(), id.data);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePath("/admin", "layout");
}
