import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Call after admin mutations that change public content. Public pages are dynamic today; this keeps caching (M8) correct.
 * The "layout" scope also covers the shared header/footer and the root metadata, which read the profile.
 */
export function revalidatePublic() {
  revalidatePath("/", "layout");
}
