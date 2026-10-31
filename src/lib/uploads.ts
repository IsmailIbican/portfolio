export type UploadKind = "image" | "document";

export interface DetectedFile {
  kind: UploadKind;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  extension: "jpg" | "png" | "webp" | "pdf";
}

/** Vercel Functions accept request bodies up to about 4.5 MB, so uploads stay safely below that. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

/**
 * Identifies a file by its content, never by the name or the browser-supplied type.
 * SVG is deliberately unsupported: it can carry scripts.
 */
export function detectFileType(bytes: Uint8Array): DetectedFile | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: "image", contentType: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "image", contentType: "image/png", extension: "png" };
  }
  // WebP: "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: "image", contentType: "image/webp", extension: "webp" };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "document", contentType: "application/pdf", extension: "pdf" };
  }
  return null;
}

export type UploadValidation = { ok: true; file: DetectedFile } | { ok: false; error: string };

export function validateUpload(bytes: Uint8Array, allowed: UploadKind): UploadValidation {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  }
  const file = detectFileType(bytes);
  if (!file || file.kind !== allowed) {
    return { ok: false, error: allowed === "image" ? "Upload a JPG, PNG or WebP image." : "Upload a PDF file." };
  }
  return { ok: true, file };
}
