import "server-only";
import path from "node:path";
import { createBlobStorage } from "./blob";
import { getBlobPublicHost } from "./blob-host";
import { createLocalStorage } from "./local";
import type { Storage } from "./types";

export type { Storage, StoredFile, StoredObject } from "./types";

let localStorageSingleton: ReturnType<typeof createLocalStorage> | undefined;
let blobStorageSingleton: Storage | undefined;

export function getLocalStorage() {
  localStorageSingleton ??= createLocalStorage(process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads"));
  return localStorageSingleton;
}

/**
 * STORAGE_DRIVER=local (default) keeps files in ./.uploads, which suits development only.
 * STORAGE_DRIVER=blob uses Vercel Blob (production); it needs BLOB_READ_WRITE_TOKEN and BLOB_PUBLIC_HOST.
 * Anything else is refused rather than silently writing to a disk that does not persist.
 */
export function getStorage(): Storage {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") return getLocalStorage();
  if (driver === "blob") {
    const host = getBlobPublicHost();
    if (!host) throw new Error("STORAGE_DRIVER=blob needs BLOB_PUBLIC_HOST (e.g. <store-id>.public.blob.vercel-storage.com).");
    blobStorageSingleton ??= createBlobStorage(host);
    return blobStorageSingleton;
  }
  throw new Error(`Unsupported STORAGE_DRIVER "${driver}".`);
}
