// @vitest-environment node
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import {
  countByStatus,
  createSubmission,
  deleteSubmission,
  isRateLimited,
  LIMIT_PER_IP,
  LIMIT_TOTAL,
  listSubmissions,
  setSubmissionStatus,
  submitMessage,
  WINDOW_MS,
} from "@/features/contact/service";
import { isRecordNotFound } from "@/lib/db-errors";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://portfolio:portfolio@localhost:5433/portfolio_test";
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to run integration tests: database name must end with _test.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

beforeEach(() => prisma.contactSubmission.deleteMany());
afterAll(async () => {
  await prisma.contactSubmission.deleteMany();
  await prisma.$disconnect();
});

const input = { name: "Ada", email: "ada@example.com", message: "Hello there, a real message." };
let tokenCounter = 0;
const freshToken = () => `token-hash-${++tokenCounter}`;
const send = (ipHash: string | null, overrides: { formTokenHash?: string; now?: Date } = {}) =>
  submitMessage(prisma, input, { ipHash, formTokenHash: overrides.formTokenHash ?? freshToken(), now: overrides.now });

describe("stored messages", () => {
  it("stores the message as NEW and keeps only the hashed visitor code and the token hash", async () => {
    await send("hash-a", { formTokenHash: "tok-1" });
    const saved = await prisma.contactSubmission.findFirstOrThrow();
    expect(saved).toMatchObject({ name: "Ada", email: "ada@example.com", status: "NEW", ipHash: "hash-a", formTokenHash: "tok-1" });
    expect(Object.keys(saved).sort()).toEqual(["createdAt", "email", "formTokenHash", "id", "ipHash", "message", "name", "status"]);
  });

  it("lists newest first, filters by status, and counts per status", async () => {
    const first = await createSubmission(prisma, { ...input, name: "First" }, "h", new Date("2026-01-01T00:00:00Z"));
    await createSubmission(prisma, { ...input, name: "Second" }, "h", new Date("2026-01-02T00:00:00Z"));
    await setSubmissionStatus(prisma, first.id, "ARCHIVED");

    expect((await listSubmissions(prisma)).map((m) => m.name)).toEqual(["Second", "First"]);
    expect((await listSubmissions(prisma, "ARCHIVED")).map((m) => m.name)).toEqual(["First"]);
    const counts = Object.fromEntries((await countByStatus(prisma)).map((row) => [row.status, row._count._all]));
    expect(counts).toEqual({ NEW: 1, ARCHIVED: 1 });
  });

  it("deletes a message and reports a missing one", async () => {
    const saved = await createSubmission(prisma, input, "h");
    await deleteSubmission(prisma, saved.id);
    await expect(deleteSubmission(prisma, saved.id)).rejects.toSatisfy(isRecordNotFound);
  });
});

describe("one-time tokens", () => {
  it("accepts a token once and refuses the same token again", async () => {
    expect(await send("v", { formTokenHash: "same-token" })).toBe("saved");
    expect(await send("v", { formTokenHash: "same-token" })).toBe("duplicate");
    expect(await prisma.contactSubmission.count()).toBe(1);
  });

  it("lets only one of many parallel requests with the same token through", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => send(null, { formTokenHash: "replayed" })));
    expect(results.filter((r) => r === "saved")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(9);
    expect(await prisma.contactSubmission.count()).toBe(1);
  });
});

describe("rate limiting", () => {
  it("allows a visitor up to the per-visitor limit within the window, then blocks", async () => {
    for (let i = 0; i < LIMIT_PER_IP; i++) expect(await send("visitor")).toBe("saved");
    expect(await send("visitor")).toBe("rate-limited");
    expect(await prisma.contactSubmission.count()).toBe(LIMIT_PER_IP);
  });

  it("does not block a different visitor", async () => {
    for (let i = 0; i < LIMIT_PER_IP; i++) await send("noisy");
    expect(await send("noisy")).toBe("rate-limited");
    expect(await send("quiet")).toBe("saved");
  });

  it("lets a visitor back in once the window has passed", async () => {
    const start = new Date("2026-06-01T12:00:00Z");
    for (let i = 0; i < LIMIT_PER_IP; i++) await send("visitor", { now: start });
    expect(await send("visitor", { now: start })).toBe("rate-limited");
    expect(await send("visitor", { now: new Date(start.getTime() + WINDOW_MS + 1000) })).toBe("saved");
  });

  it("cannot be beaten by a burst of simultaneous requests", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => send("burst")));
    expect(results.filter((r) => r === "saved")).toHaveLength(LIMIT_PER_IP);
    expect(results.filter((r) => r === "rate-limited")).toHaveLength(30 - LIMIT_PER_IP);
    expect(await prisma.contactSubmission.count({ where: { ipHash: "burst" } })).toBe(LIMIT_PER_IP);
  });

  it("applies an overall cap against many different visitors, even a burst of them", async () => {
    const results = await Promise.all(Array.from({ length: LIMIT_TOTAL + 15 }, (_, index) => send(`bot-${index}`)));
    expect(results.filter((r) => r === "saved")).toHaveLength(LIMIT_TOTAL);
    expect(await prisma.contactSubmission.count()).toBe(LIMIT_TOTAL);
  });

  it("without a trusted visitor address, only the overall cap applies (no shared bucket for everyone)", async () => {
    for (let i = 0; i < LIMIT_PER_IP + 3; i++) expect(await send(null)).toBe("saved");
    expect(await isRateLimited(prisma, null)).toBe(false);
  });
});

describe("data kept", () => {
  it("erases visitor codes older than the rate-limit window when a new message arrives", async () => {
    const old = new Date("2026-06-01T10:00:00Z");
    await createSubmission(prisma, input, "old-visitor", old);
    await send("new-visitor", { now: new Date("2026-06-01T12:00:00Z") });

    const rows = await prisma.contactSubmission.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => row.ipHash)).toEqual([null, "new-visitor"]);
    expect(rows).toHaveLength(2); // the message itself stays; only the visitor code goes
  });
});
