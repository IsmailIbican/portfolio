"use server";

import { educationSchema } from "@/features/education/schema";
import { createEducation, deleteEducation, updateEducation } from "@/features/education/service";
import { recordId } from "@/features/shared/fields";
import { fromZodError, type FormState } from "@/features/shared/form-state";
import { getDb } from "@/lib/db";
import { isRecordNotFound } from "@/lib/db-errors";
import { revalidatePublic } from "@/lib/revalidate";
import { requireAdmin } from "@/lib/session";

export async function createEducationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = educationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  await createEducation(getDb(), parsed.data);
  revalidatePublic();
  return { ok: true, message: "Education added." };
}

export async function updateEducationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  const parsed = educationSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { message: "Missing record." };
  if (!parsed.success) return fromZodError(parsed.error, formData);

  try {
    await updateEducation(getDb(), id.data, parsed.data);
  } catch (error) {
    if (isRecordNotFound(error)) return { message: "This entry no longer exists." };
    throw error;
  }
  revalidatePublic();
  return { ok: true, message: "Saved." };
}

export async function deleteEducationAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await deleteEducation(getDb(), id.data);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePublic();
}
