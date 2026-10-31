import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { addProjectMedia } from "@/features/projects/service";
import { mediaAltSchema } from "@/features/projects/schema";
import { recordId } from "@/features/shared/fields";
import { getDb } from "@/lib/db";
import { isRecordNotFound } from "@/lib/db-errors";
import { isSameOrigin } from "@/lib/origin";
import { revalidatePublic } from "@/lib/revalidate";
import { getAdmin } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, validateUpload, type UploadKind } from "@/lib/uploads";

const TARGETS: Record<string, UploadKind> = {
  "project-media": "image",
  avatar: "image",
  cv: "document",
};

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Admin-only upload. Order of checks: same origin, signed-in admin, declared size, then the file content itself.
 * The browser-supplied file name and type are never trusted: the type comes from the bytes, the name is random.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Forbidden.");

  const admin = await getAdmin();
  if (!admin) return fail(401, "Not signed in.");

  // Cheap rejection before buffering the body. Browsers always send Content-Length for form uploads;
  // the exact limit is still enforced on the bytes below.
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return fail(411, "Content-Length is required.");
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "The file is too large.");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail(400, "Invalid upload.");
  }

  const target = String(formData.get("target") ?? "");
  const allowed = TARGETS[target];
  if (!allowed) return fail(400, "Unknown upload target.");

  const files = formData.getAll("file");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File)) return fail(400, "Send exactly one file.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateUpload(bytes, allowed);
  if (!checked.ok) return fail(400, checked.error);

  let projectId: string | null = null;
  let alt: string | null = null;
  if (target === "project-media") {
    const id = recordId.safeParse(formData.get("projectId"));
    const parsedAlt = mediaAltSchema.safeParse(formData.get("alt"));
    if (!id.success) return fail(400, "Missing project.");
    if (!parsedAlt.success) return fail(400, parsedAlt.error.issues[0]?.message ?? "Describe the image.");
    projectId = id.data;
    alt = parsedAlt.data;
  }

  const key = `${checked.file.kind === "image" ? "images" : "documents"}/${randomUUID()}.${checked.file.extension}`;
  const stored = await getStorage().put(key, bytes, checked.file.contentType);

  if (projectId && alt) {
    try {
      const media = await addProjectMedia(getDb(), projectId, { url: stored.url, alt });
      revalidatePublic();
      return NextResponse.json({ url: stored.url, id: media.id });
    } catch (error) {
      await getStorage().remove(stored.url); // do not leave an orphan behind
      if (isRecordNotFound(error) || (error as { code?: string }).code === "P2003") return fail(404, "Project not found.");
      throw error;
    }
  }

  return NextResponse.json({ url: stored.url });
}
