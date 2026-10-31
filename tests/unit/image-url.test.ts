// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isHostedImageUrl } from "@/lib/image-url";

const HOST = "abc123def456.public.blob.vercel-storage.com";
const original = process.env.BLOB_PUBLIC_HOST;

beforeEach(() => {
  process.env.BLOB_PUBLIC_HOST = HOST;
});
afterEach(() => {
  if (original === undefined) delete process.env.BLOB_PUBLIC_HOST;
  else process.env.BLOB_PUBLIC_HOST = original;
});

describe("isHostedImageUrl", () => {
  it("accepts our upload route and images in our Blob store", () => {
    expect(isHostedImageUrl("/uploads/images/0b9d3a2e-5c1f-4a7e-9d62-1f3b8c7a4e10.png")).toBe(true);
    expect(isHostedImageUrl(`https://${HOST}/images/0b9d3a2e-5c1f-4a7e-9d62-1f3b8c7a4e10.webp`)).toBe(true);
  });

  it("rejects external links, other stores, http and look-alike hosts", () => {
    expect(isHostedImageUrl("https://example.com/me.png")).toBe(false);
    expect(isHostedImageUrl("https://other.public.blob.vercel-storage.com/images/a.png")).toBe(false);
    expect(isHostedImageUrl(`http://${HOST}/images/a.png`)).toBe(false);
    expect(isHostedImageUrl(`https://${HOST}.evil.example/images/a.png`)).toBe(false);
  });

  it("rejects query strings, other paths, protocol-relative and malformed values", () => {
    expect(isHostedImageUrl("/uploads/images/a.png?x=1")).toBe(false);
    expect(isHostedImageUrl(`https://${HOST}/images/a.png?x=1`)).toBe(false);
    expect(isHostedImageUrl(`https://${HOST}/documents/cv.pdf`)).toBe(false);
    expect(isHostedImageUrl("/other/a.png")).toBe(false);
    expect(isHostedImageUrl("//evil.example/uploads/a.png")).toBe(false);
    expect(isHostedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isHostedImageUrl("")).toBe(false);
  });

  it("accepts no absolute URL when no Blob host is configured", () => {
    delete process.env.BLOB_PUBLIC_HOST;
    expect(isHostedImageUrl(`https://${HOST}/images/a.png`)).toBe(false);
    expect(isHostedImageUrl("/uploads/images/a.png")).toBe(true);
  });
});
