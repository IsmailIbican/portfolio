"use server";

import { recordId } from "@/features/shared/fields";
import { fromZodError, formValues, type FormState } from "@/features/shared/form-state";
import { technologySchema } from "@/features/technologies/schema";
import { createTechnology, deleteTechnology, updateTechnology } from "@/features/technologies/service";
import { getDb } from "@/lib/db";
import { isRecordNotFound, isUniqueViolation } from "@/lib/db-errors";
import { revalidatePublic } from "@/lib/revalidate";
import { requireAdmin } from "@/lib/session";

const duplicate = (formData: FormData): FormState => ({
  message: "Please fix the highlighted fields.",
  errors: { name: ["A technology with this name already exists."] },
  values: formValues(formData),
});

export async function createTechnologyAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = technologySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  try {
    await createTechnology(getDb(), parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return duplicate(formData);
    throw error;
  }
  revalidatePublic();
  return { ok: true, message: "Technology added." };
}

export async function updateTechnologyAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  const parsed = technologySchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { message: "Missing record." };
  if (!parsed.success) return fromZodError(parsed.error, formData);

  try {
    await updateTechnology(getDb(), id.data, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return duplicate(formData);
    if (isRecordNotFound(error)) return { message: "This technology no longer exists." };
    throw error;
  }
  revalidatePublic();
  return { ok: true, message: "Saved." };
}

export async function deleteTechnologyAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await deleteTechnology(getDb(), id.data);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePublic();
}
