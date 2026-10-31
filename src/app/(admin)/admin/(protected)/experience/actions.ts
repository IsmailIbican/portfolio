"use server";

import { experienceSchema } from "@/features/experience/schema";
import { createExperience, deleteExperience, updateExperience } from "@/features/experience/service";
import { fromZodError, type FormState } from "@/features/shared/form-state";
import { recordId } from "@/features/shared/fields";
import { getDb } from "@/lib/db";
import { isRecordNotFound } from "@/lib/db-errors";
import { revalidatePublic } from "@/lib/revalidate";
import { requireAdmin } from "@/lib/session";

export async function createExperienceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = experienceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  await createExperience(getDb(), parsed.data);
  revalidatePublic();
  return { ok: true, message: "Experience added." };
}

export async function updateExperienceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  const parsed = experienceSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { message: "Missing record." };
  if (!parsed.success) return fromZodError(parsed.error, formData);

  try {
    await updateExperience(getDb(), id.data, parsed.data);
  } catch (error) {
    if (isRecordNotFound(error)) return { message: "This entry no longer exists." };
    throw error;
  }
  revalidatePublic();
  return { ok: true, message: "Saved." };
}

export async function deleteExperienceAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await deleteExperience(getDb(), id.data);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePublic();
}
