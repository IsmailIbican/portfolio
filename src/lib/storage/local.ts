import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SAFE_KEY } from "./keys";
import type { Storage, StoredObject } from "./types";

export const UPLOAD_URL_PREFIX = "/uploads/";

export function createLocalStorage(rootDirectory: string): Storage & { read(key: string): Promise<Buffer | null> } {
  const root = path.resolve(rootDirectory);

  function resolveKey(key: string): string | null {
    if (!SAFE_KEY.test(key)) return null;
    const target = path.resolve(root, key);
    return target.startsWith(root + path.sep) ? target : null;
  }

  return {
    async put(key, data) {
      const target = resolveKey(key);
      if (!target) throw new Error(`Invalid storage key: ${key}`);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
      return { url: `${UPLOAD_URL_PREFIX}${key}` };
    },

    async remove(url) {
      if (!url.startsWith(UPLOAD_URL_PREFIX)) return false; // external links are not ours to delete
      const target = resolveKey(url.slice(UPLOAD_URL_PREFIX.length));
      if (!target) return false;
      await rm(target, { force: true });
      return true;
    },

    async list() {
      const files: StoredObject[] = [];
      for (const folder of ["images", "documents"]) {
        const names = await readdir(path.join(root, folder)).catch(() => [] as string[]);
        for (const name of names) {
          const key = `${folder}/${name}`;
          const target = resolveKey(key);
          if (!target) continue;
          // A file deleted between readdir and stat is simply gone; it must not abort the whole listing.
          const info = await stat(target).catch(() => null);
          if (info) files.push({ url: `${UPLOAD_URL_PREFIX}${key}`, uploadedAt: info.mtime });
        }
      }
      return files;
    },

    async read(key) {
      const target = resolveKey(key);
      if (!target) return null;
      try {
        // Development-only store at an absolute, validated path. Without this marker the bundler would trace
        // the whole project into the server output (and into the Vercel deployment).
        return await readFile(/* turbopackIgnore: true */ target);
      } catch {
        return null;
      }
    },
  };
}
