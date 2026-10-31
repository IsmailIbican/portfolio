// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { putMock, delMock, listMock } = vi.hoisted(() => ({ putMock: vi.fn(), delMock: vi.fn(), listMock: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: putMock, del: delMock, list: listMock }));

const { createBlobStorage } = await import("@/lib/storage/blob");
const { getBlobPublicHost } = await import("@/lib/storage/blob-host");

const HOST = "abc123def456.public.blob.vercel-storage.com";
const KEY = "images/0b9d3a2e-5c1f-4a7e-9d62-1f3b8c7a4e10.png";

beforeEach(() => {
  putMock.mockReset();
  delMock.mockReset();
  listMock.mockReset();
});

describe("createBlobStorage", () => {
  it("uploads with public access, the given content type and no random suffix", async () => {
    putMock.mockResolvedValue({ url: `https://${HOST}/${KEY}` });
    const result = await createBlobStorage(HOST).put(KEY, new Uint8Array([1, 2, 3]), "image/png");

    expect(result).toEqual({ url: `https://${HOST}/${KEY}` });
    const [pathname, body, options] = putMock.mock.calls[0] as [string, Buffer, Record<string, unknown>];
    expect(pathname).toBe(KEY);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(options).toMatchObject({ access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: false });
  });

  it("refuses keys the server did not generate", async () => {
    const storage = createBlobStorage(HOST);
    await expect(storage.put("../evil.png", new Uint8Array([1]), "image/png")).rejects.toThrow("Invalid storage key");
    await expect(storage.put("images/con.png", new Uint8Array([1]), "image/png")).rejects.toThrow("Invalid storage key");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("deletes files in its own store and says so", async () => {
    expect(await createBlobStorage(HOST).remove(`https://${HOST}/${KEY}`)).toBe(true);
    expect(delMock).toHaveBeenCalledWith(`https://${HOST}/${KEY}`);
  });

  it("never deletes external links, other stores, http URLs, site paths or garbage", async () => {
    const storage = createBlobStorage(HOST);
    const ignored = [
      await storage.remove(`https://other.public.blob.vercel-storage.com/${KEY}`),
      await storage.remove(`https://${HOST}.evil.example/${KEY}`),
      await storage.remove(`http://${HOST}/${KEY}`),
      await storage.remove(`/uploads/${KEY}`),
      await storage.remove("not a url"),
    ];
    expect(ignored).toEqual([false, false, false, false, false]);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("lists every page and keeps only files with server-generated keys", async () => {
    const uploadedAt = new Date("2026-01-01T00:00:00Z");
    const other = "images/11111111-2222-4333-8444-555555555555.webp";
    listMock
      .mockResolvedValueOnce({ blobs: [{ url: `https://${HOST}/${KEY}`, pathname: KEY, uploadedAt }, { url: `https://${HOST}/stray.txt`, pathname: "stray.txt", uploadedAt }], hasMore: true, cursor: "next" })
      .mockResolvedValueOnce({ blobs: [{ url: `https://${HOST}/${other}`, pathname: other, uploadedAt }], hasMore: false });

    const files = await createBlobStorage(HOST).list();

    expect(files).toEqual([
      { url: `https://${HOST}/${KEY}`, uploadedAt },
      { url: `https://${HOST}/${other}`, uploadedAt },
    ]);
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(listMock.mock.calls[1]?.[0]).toMatchObject({ cursor: "next" });
  });
});

describe("getBlobPublicHost", () => {
  const original = process.env.BLOB_PUBLIC_HOST;
  afterEach(() => {
    if (original === undefined) delete process.env.BLOB_PUBLIC_HOST;
    else process.env.BLOB_PUBLIC_HOST = original;
  });

  it("returns a valid store host, normalised", () => {
    process.env.BLOB_PUBLIC_HOST = `  ${HOST.toUpperCase()} `;
    expect(getBlobPublicHost()).toBe(HOST);
  });

  it("returns null when unset or not a Blob host, so the image allow-lists never widen", () => {
    delete process.env.BLOB_PUBLIC_HOST;
    expect(getBlobPublicHost()).toBeNull();
    for (const bad of ["", "*.public.blob.vercel-storage.com", "evil.example", `${HOST}.evil.example`, `https://${HOST}`, `${HOST}/path`]) {
      process.env.BLOB_PUBLIC_HOST = bad;
      expect(getBlobPublicHost()).toBeNull();
    }
  });
});
