"use server";

import { profileFormSchema } from "@/features/profile/schema";
import { getProfile, saveProfile } from "@/features/profile/service";
import { fromZodError, type FormState } from "@/features/shared/form-state";
import { getDb } from "@/lib/db";
import { revalidatePublic } from "@/lib/revalidate";
import { requireAdmin } from "@/lib/session";
import { getStorage } from "@/lib/storage";

export async function saveProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = profileFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const db = getDb();
  const before = await getProfile(db);
  await saveProfile(db, parsed.data);

  // A replaced or cleared CV/photo must not stay online (an old CV may hold contact details).
  // remove() ignores links that are not our own uploads, and a failed delete must not undo the save.
  const replaced = [
    before?.cvUrl && before.cvUrl !== parsed.data.profile.cvUrl ? before.cvUrl : null,
    before?.avatarUrl && before.avatarUrl !== parsed.data.profile.avatarUrl ? before.avatarUrl : null,
  ].filter((url) => url !== null);
  await Promise.allSettled(replaced.map((url) => getStorage().remove(url)));

  revalidatePublic();
  return { ok: true, message: "Saved." };
}
