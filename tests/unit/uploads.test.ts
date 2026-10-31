// @vitest-environment node
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/origin";
import { storageKeyOf } from "@/lib/storage/keys";
import { createLocalStorage } from "@/lib/storage/local";
import { detectFileType, MAX_UPLOAD_BYTES, validateUpload } from "@/lib/uploads";

const bytes = (...values: number[]) => new Uint8Array(values);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const PDF = new TextEncoder().encode("%PDF-1.7\n...");

describe("detectFileType", () => {
  it("recognises allowed formats by content", () => {
    expect(detectFileType(PNG)?.extension).toBe("png");
    expect(detectFileType(JPEG)?.extension).toBe("jpg");
    expect(detectFileType(WEBP)?.extension).toBe("webp");
    expect(detectFileType(PDF)?.extension).toBe("pdf");
  });

  it("rejects SVG, HTML and unknown content", () => {
    expect(detectFileType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(bytes(1, 2, 3, 4))).toBeNull();
  });

  it("does not mistake a RIFF file that is not WebP for an image", () => {
    expect(detectFileType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepts an image where images are allowed", () => {
    expect(validateUpload(PNG, "image").ok).toBe(true);
  });

  it("refuses the wrong kind for the target", () => {
    expect(validateUpload(PDF, "image").ok).toBe(false);
    expect(validateUpload(PNG, "document").ok).toBe(false);
  });

  it("refuses empty and oversized files", () => {
    expect(validateUpload(new Uint8Array(0), "image").ok).toBe(false);
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(PNG);
    expect(validateUpload(big, "image").ok).toBe(false);
  });

  it("a script renamed to .png is still refused because only content counts", () => {
    expect(validateUpload(new TextEncoder().encode("<script>alert(1)</script>"), "image").ok).toBe(false);
  });
});

describe("local storage", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "uploads-test-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const KEY = "images/3f2b8c1e-9a4d-4e7b-8c6a-1d2e3f4a5b6c.png";

  it("stores, reads and removes a file under a generated key", async () => {
    const storage = createLocalStorage(root);
    const { url } = await storage.put(KEY, PNG, "image/png");
    expect(url).toBe(`/uploads/${KEY}`);
    expect(await readFile(path.join(root, KEY))).toHaveLength(PNG.length);
    expect(await storage.read(KEY)).not.toBeNull();

    await storage.remove(url);
    await expect(stat(path.join(root, KEY))).rejects.toThrow();
  });

  it("accepts only server-shaped keys: UUID names, known folders and extensions", async () => {
    const storage = createLocalStorage(root);
    await expect(storage.put("images/con.png", PNG, "image/png")).rejects.toThrow();
    await expect(storage.put("images/abc-123.png", PNG, "image/png")).rejects.toThrow();
    await expect(storage.put("other/3f2b8c1e-9a4d-4e7b-8c6a-1d2e3f4a5b6c.png", PNG, "image/png")).rejects.toThrow();
    await expect(storage.put("images/3f2b8c1e-9a4d-4e7b-8c6a-1d2e3f4a5b6c.svg", PNG, "image/png")).rejects.toThrow();
  });

  it("refuses keys that try to escape the upload directory", async () => {
    const storage = createLocalStorage(root);
    await expect(storage.put("../escape.png", PNG, "image/png")).rejects.toThrow();
    await expect(storage.put("images/../../escape.png", PNG, "image/png")).rejects.toThrow();
    await expect(storage.put("/etc/passwd", PNG, "image/png")).rejects.toThrow();
    expect(await storage.read("../secret.txt")).toBeNull();
  });

  it("ignores removal of external URLs and traversal attempts, and reports that it did", async () => {
    const storage = createLocalStorage(root);
    expect(await storage.remove("https://example.com/a.png")).toBe(false);
    expect(await storage.remove("/uploads/../../package.json")).toBe(false);
    expect(await storage.remove("/other/images/a.png")).toBe(false);
  });

  it("reports a real removal as true", async () => {
    const storage = createLocalStorage(root);
    const { url } = await storage.put(KEY, PNG, "image/png");
    expect(await storage.remove(url)).toBe(true);
  });

  it("lists stored files with their modification time and skips strays", async () => {
    const storage = createLocalStorage(root);
    const OTHER = "documents/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.pdf";
    await storage.put(KEY, PNG, "image/png");
    await storage.put(OTHER, PDF, "application/pdf");
    await writeFile(path.join(root, "images", "stray.txt"), "x");

    const files = await storage.list();

    expect(files.map((file) => file.url).sort()).toEqual([`/uploads/${OTHER}`, `/uploads/${KEY}`].sort());
    expect(Date.now() - files[0]!.uploadedAt.getTime()).toBeLessThan(60_000);
  });

  it("lists nothing when the folders do not exist yet", async () => {
    expect(await createLocalStorage(path.join(root, "missing")).list()).toEqual([]);
  });

  it("returns null for a missing file", async () => {
    expect(await createLocalStorage(root).read("images/3f2b8c1e-9a4d-4e7b-8c6a-1d2e3f4a5b6c.png")).toBeNull();
  });
});

describe("isSameOrigin", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost:3000/api", { method: "POST", headers });

  it("accepts a matching Origin", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
  });

  it("rejects a different or missing Origin", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "localhost:3000" }))).toBe(false);
  });
});

describe("storageKeyOf", () => {
  const KEY = "images/3f2b8c1e-9a4d-4e7b-8c6a-1d2e3f4a5b6c.png";

  it("finds the key in site paths, Blob URLs, absolute local addresses and links with a query or fragment", () => {
    expect(storageKeyOf(`/uploads/${KEY}`)).toBe(KEY);
    expect(storageKeyOf(`https://Store.public.blob.vercel-storage.com/${KEY}`)).toBe(KEY);
    expect(storageKeyOf(`http://localhost:3000/uploads/${KEY}?v=2#top`)).toBe(KEY);
  });

  it("returns null for anything that does not end in a generated key", () => {
    expect(storageKeyOf("/uploads/images/cv.pdf")).toBeNull();
    expect(storageKeyOf("https://example.com/")).toBeNull();
    expect(storageKeyOf(`/uploads/${KEY}.exe`)).toBeNull();
    expect(storageKeyOf(`/uploads/x${KEY}`)).toBeNull();
    expect(storageKeyOf("")).toBeNull();
  });
});
