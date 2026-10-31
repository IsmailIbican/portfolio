import { getLocalStorage } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Serves files from the local development store. With any other STORAGE_DRIVER (Vercel Blob in production, M9)
 * files live elsewhere, so this route answers 404 and exposes nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") return new Response("Not found", { status: 404 });

  const { path: segments } = await params;
  if (segments.length !== 2) return new Response("Not found", { status: 404 });

  const key = segments.join("/");
  const extension = key.split(".").pop() ?? "";
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return new Response("Not found", { status: 404 });

  const data = await getLocalStorage().read(key);
  if (!data) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    // File names are random and never reused, so they can be cached for good.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  // The sandbox CSP can stop some browsers' built-in PDF viewer, so PDFs are offered as downloads instead.
  if (extension === "pdf") headers["Content-Disposition"] = 'attachment; filename="document.pdf"';

  return new Response(new Uint8Array(data), { headers });
}
