import { del, list, put } from "@vercel/blob";
import { SAFE_KEY } from "./keys";
import type { Storage, StoredObject } from "./types";

/** Keys contain a random UUID, so a stored file never changes and browsers may keep it for a year. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Vercel Blob store with public access. The token is read from BLOB_READ_WRITE_TOKEN by the SDK. */
export function createBlobStorage(publicHost: string): Storage {
  return {
    async put(key, data, contentType) {
      if (!SAFE_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`);
      const stored = await put(key, Buffer.from(data), {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: ONE_YEAR_SECONDS,
      });
      return { url: stored.url };
    },

    async remove(url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return false; // a site path or garbage: not ours to delete
      }
      // Only files in our own store; an external link saved by the admin must never reach the delete call.
      if (parsed.protocol !== "https:" || parsed.hostname !== publicHost) return false;
      await del(parsed.href);
      return true;
    },

    async list() {
      const files: StoredObject[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ cursor, limit: 1000 });
        for (const blob of page.blobs) {
          if (SAFE_KEY.test(blob.pathname)) files.push({ url: blob.url, uploadedAt: blob.uploadedAt });
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return files;
    },
  };
}
