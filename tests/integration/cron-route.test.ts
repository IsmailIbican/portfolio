// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import type { Storage } from "@/lib/storage";

const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(testUrl).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}

const holder = vi.hoisted(() => ({ storage: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/revalidate", () => ({ revalidatePublic: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getStorage: () => holder.storage }));

const SECRET = "cron-test-secret-0123456789-abcdefghijkl";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
let GET: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", testUrl);
  ({ GET } = await import("@/app/api/cron/daily/route"));
});

async function clean() {
  await prisma.contactSubmission.deleteMany();
  await prisma.projectMedia.deleteMany();
  await prisma.project.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.siteSettings.deleteMany();
}
beforeEach(async () => {
  await clean();
  // The route opens its own connection from DATABASE_URL: always point it at the disposable test database.
  vi.stubEnv("DATABASE_URL", testUrl);
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("VERCEL_ENV", "");
  await prisma.contactSubmission.create({
    data: { name: "old", email: "a@example.com", message: "hi", createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const call = (authorization?: string) => GET(new Request("http://localhost/api/cron/daily", authorization ? { headers: { authorization } } : {}));
const oldMessages = () => prisma.contactSubmission.count();

const orphanKey = "images/00000000-0000-4000-8000-000000000001.png";
function storageWith(list: Storage["list"], removed: string[] = []): Storage {
  return {
    put: async () => ({ url: "" }),
    remove: async (fileUrl) => {
      removed.push(fileUrl);
      return true;
    },
    list,
  };
}

describe("GET /api/cron/daily", () => {
  it("answers 503 when no secret is configured, and does nothing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(await oldMessages()).toBe(1);
  });

  it("answers 401 without the header or with a wrong token, and does nothing", async () => {
    for (const header of [undefined, "Bearer wrong", SECRET]) {
      const response = await call(header);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: { code: "unauthorized", message: "Unauthorized." } });
    }
    expect(await oldMessages()).toBe(1);
  });

  it("runs the steps with the right token; outside production the upload sweep is skipped", async () => {
    const list = vi.fn(async () => [{ url: `/uploads/${orphanKey}`, uploadedAt: new Date(0) }]);
    holder.storage = storageWith(list);

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: { ok: true, detail: { deleted: 1 } },
      uploads: { ok: true, detail: { skipped: 1 } },
      github: { ok: true, detail: { skipped: 1 } },
    });
    expect(await oldMessages()).toBe(0);
    expect(list).not.toHaveBeenCalled();
  });

  it("sweeps orphaned uploads in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const removed: string[] = [];
    holder.storage = storageWith(async () => [{ url: `/uploads/${orphanKey}`, uploadedAt: new Date(0) }], removed);

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect((await response.json()).uploads).toEqual({ ok: true, detail: { checked: 1, deleted: 1, failed: 0 } });
    expect(removed).toEqual([`/uploads/${orphanKey}`]);
  });

  it("still runs the other steps when one fails, and answers 500 without leaking the reason", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    holder.storage = storageWith(async () => {
      throw new Error("token abc123 expired");
    });

    const response = await call(`Bearer ${SECRET}`);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toMatchObject({ messages: { ok: true }, uploads: { ok: false }, github: { ok: true } });
    expect(text).not.toContain("abc123");
    expect(await oldMessages()).toBe(0);
  });
});
