"use server";

import { redirect } from "next/navigation";
import { projectFormInput, projectSchema } from "@/features/projects/schema";
import { createProject, deleteProject, deleteProjectMedia, updateProject } from "@/features/projects/service";
import { recordId } from "@/features/shared/fields";
import { formValues, fromZodError, type FormState } from "@/features/shared/form-state";
import { getDb } from "@/lib/db";
import { isRecordNotFound, isUniqueViolation } from "@/lib/db-errors";
import { revalidatePublic } from "@/lib/revalidate";
import { requireAdmin } from "@/lib/session";
import { getStorage } from "@/lib/storage";

const slugTaken = (formData: FormData): FormState => ({
  message: "Please fix the highlighted fields.",
  errors: { slug: ["This URL name is already used by another project."] },
  values: formValues(formData),
});

/** Foreign-key failure: a selected technology was deleted in the meantime. */
const isForeignKeyViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2003";

async function removeFiles(urls: string[]) {
  // Best effort: a failed file delete must not undo a successful database change.
  await Promise.allSettled(urls.map((url) => getStorage().remove(url)));
}

export async function createProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = projectSchema.safeParse(projectFormInput(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  let id: string;
  try {
    id = (await createProject(getDb(), parsed.data)).id;
  } catch (error) {
    if (isUniqueViolation(error)) return slugTaken(formData);
    if (isForeignKeyViolation(error)) return { message: "A selected technology no longer exists. Reload the page." };
    throw error;
  }
  revalidatePublic();
  // Continue on the edit page, where screenshots can be added.
  redirect(`/admin/projects/${id}`);
}

export async function updateProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  const parsed = projectSchema.safeParse(projectFormInput(formData));
  if (!id.success) return { message: "Missing record." };
  if (!parsed.success) return fromZodError(parsed.error, formData);

  try {
    await updateProject(getDb(), id.data, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return slugTaken(formData);
    if (isRecordNotFound(error)) return { message: "This project no longer exists." };
    if (isForeignKeyViolation(error)) return { message: "A selected technology no longer exists. Reload the page." };
    throw error;
  }
  revalidatePublic();
  return { ok: true, message: "Saved." };
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await removeFiles(await deleteProject(getDb(), id.data));
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePublic();
  redirect("/admin/projects");
}

export async function deleteProjectMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await removeFiles([await deleteProjectMedia(getDb(), id.data)]);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
  }
  revalidatePublic();
}
