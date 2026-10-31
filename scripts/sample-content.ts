/**
 * Fills the LOCAL database with clearly fictional sample content, so the site can be judged with realistic pages.
 *
 *   npm run sample:add      add the sample content
 *   npm run sample:remove   delete it again and restore the profile
 *
 * Safety rules:
 * - refuses any database that is not on localhost
 * - never overwrites a profile field that already has a value (only empty ones are filled)
 * - every record it creates has an id starting with "sample-", which is how `remove` finds exactly its own rows
 * - leaves your own projects, technologies, experience and messages alone
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createLocalStorage } from "../src/lib/storage/local";

config({ path: ".env.local" });
config();

const PREFIX = "sample-";
const BACKUP = ".sample-backup.json";

// ---- fictional content -------------------------------------------------------------------------------------

const PROFILE = {
  fullName: "Alex Example",
  headline: "Full-stack software engineer (sample data)",
  statement: "I build reliable web products, from the database to the interface, and care about clear code and calm design.",
  bio: [
    "SAMPLE DATA: this text is fictional and only here to show how the page looks when it is filled in.",
    "I have spent the last years building web applications end to end: designing data models, writing APIs, and shaping interfaces that stay fast and accessible. I like small, well-tested pieces and clear documentation.",
    "Outside of work I contribute to open source, write about what I learn, and enjoy turning messy problems into simple tools.",
  ].join("\n\n"),
  location: "Sample City",
  contactEmail: "hello@example.com",
  linkedinUrl: "https://www.linkedin.com/in/example-sample",
  websiteUrl: "https://example.com",
};

const SETTINGS = {
  siteTitle: "Alex Example - Software Engineer (sample)",
  siteDescription: "Sample portfolio of a full-stack software engineer: projects, experience and writing. This is placeholder content.",
};

const TECHNOLOGIES = [
  { name: "TypeScript", category: "LANGUAGE", key: true },
  { name: "Python", category: "LANGUAGE", key: true },
  { name: "SQL", category: "LANGUAGE", key: false },
  { name: "React", category: "FRONTEND", key: true },
  { name: "Next.js", category: "FRONTEND", key: true },
  { name: "Tailwind CSS", category: "FRONTEND", key: false },
  { name: "Node.js", category: "BACKEND", key: true },
  { name: "REST APIs", category: "BACKEND", key: false },
  { name: "PostgreSQL", category: "DATABASE", key: true },
  { name: "Redis", category: "DATABASE", key: false },
  { name: "Docker", category: "DEVOPS", key: false },
  { name: "GitHub Actions", category: "DEVOPS", key: false },
  { name: "Git", category: "TOOL", key: false },
  { name: "Playwright", category: "TOOL", key: false },
] as const;

const EXPERIENCE = [
  { company: "Example Corp (sample)", role: "Senior Software Engineer", location: "Remote", start: "2023-03", end: null, description: "Lead engineer on a customer-facing web platform.\nReduced page load times by splitting heavy screens and caching expensive queries.\nMentored three engineers and introduced a lightweight review checklist." },
  { company: "Sample Labs", role: "Software Engineer", location: "Sample City", start: "2020-06", end: "2023-02", description: "Built internal tools and public APIs used by several teams.\nMigrated a legacy reporting job to a queue-based service, cutting failures sharply.\nWrote the team's first end-to-end test suite." },
  { company: "Placeholder Studio", role: "Junior Developer", location: "Sample City", start: "2018-09", end: "2020-05", description: "Implemented features for client websites, fixed bugs, and learned to ship small changes safely." },
];

const EDUCATION = [
  { institution: "Example University (sample)", degree: "BSc", field: "Computer Engineering", start: "2014-09", end: "2018-06", description: "Focus on software engineering and databases." },
  { institution: "Sample Academy", degree: "Certificate", field: "Cloud Fundamentals", start: "2021-01", end: "2021-04", description: null },
];

const PROJECTS = [
  {
    slug: "sample-analytics-dashboard", title: "Analytics Dashboard (sample)", featured: true, status: "PUBLISHED", order: 0, color: [37, 99, 235],
    summary: "A responsive dashboard that turns raw event data into readable charts and weekly summaries.",
    overview: "A small analytics product for teams that want answers without a data team. It collects events, aggregates them nightly and shows the results in a fast, accessible interface.",
    problem: "Teams were exporting spreadsheets by hand every week, and the numbers never matched between people.",
    solution: "A single source of truth with scheduled aggregation, shareable views and a plain-language summary email.",
    architecture: "Next.js front end, a Node.js API, PostgreSQL for events and materialised daily rollups, and a queue for the nightly jobs.",
    implementation: "Server components for the heavy pages, cursor pagination on large tables, and a small design system shared by every chart.",
    challenges: "Keeping charts accessible (patterns as well as colour) and keeping the aggregation job idempotent when it restarts.",
    results: "Weekly reporting time dropped from half a day to a few minutes, and the numbers stopped disagreeing.",
    repoUrl: "https://example.com/repo/analytics-dashboard", liveUrl: "https://example.com/analytics-demo",
    tech: ["TypeScript", "React", "Next.js", "PostgreSQL", "Docker"],
  },
  {
    slug: "sample-task-tracker-api", title: "Task Tracker API (sample)", featured: true, status: "PUBLISHED", order: 1, color: [5, 150, 105],
    summary: "A clean REST API for tasks, projects and teams, with tests and generated documentation.",
    overview: "A reference backend showing validation, authorization and pagination done carefully.",
    problem: null, solution: "Typed request validation, role-based access and an OpenAPI description kept in sync with the code.",
    architecture: null, implementation: "Layered structure (routes, services, data access) with integration tests against a real database.", challenges: null,
    results: "Fully covered by tests and used as a template for later services.",
    repoUrl: "https://example.com/repo/task-tracker-api", liveUrl: null,
    tech: ["TypeScript", "Node.js", "REST APIs", "PostgreSQL", "Redis", "GitHub Actions"],
  },
  {
    slug: "sample-data-pipeline", title: "Data Pipeline Toolkit (sample)", featured: false, status: "PUBLISHED", order: 2, color: [217, 119, 6],
    summary: "Small Python tools to clean, validate and load CSV exports into a database.",
    overview: "A set of command-line tools with clear error reports.", problem: null, solution: null, architecture: null,
    implementation: null, challenges: null, results: null,
    repoUrl: "https://example.com/repo/data-pipeline", liveUrl: null,
    tech: ["Python", "SQL", "PostgreSQL", "Git"],
  },
  {
    slug: "sample-portfolio-starter", title: "Portfolio Starter (sample)", featured: false, status: "PUBLISHED", order: 3, color: [124, 58, 237],
    summary: "A minimal, accessible portfolio starter with dark and light themes.",
    overview: null, problem: null, solution: null, architecture: null, implementation: null, challenges: null, results: null,
    repoUrl: null, liveUrl: "https://example.com/portfolio-starter",
    tech: ["TypeScript", "Next.js", "Tailwind CSS", "Playwright"],
  },
  {
    slug: "sample-unfinished-idea", title: "Unfinished Idea (sample draft)", featured: false, status: "DRAFT", order: 4, color: [100, 116, 139],
    summary: "A draft project that must NOT appear on the public site.",
    overview: null, problem: null, solution: null, architecture: null, implementation: null, challenges: null, results: null,
    repoUrl: null, liveUrl: null, tech: [],
  },
] as const;

// ---- helpers -------------------------------------------------------------------------------------------------

const slugOf = (name: string) => name.toLowerCase().replace(/\+/g, "plus").replace(/#/g, "sharp").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const monthDate = (value: string) => new Date(`${value}-01T00:00:00.000Z`);

/** A plain 16:9 placeholder PNG (stripes of one colour), built without any image library. */
function placeholderPng([r, g, b]: readonly [number, number, number], width = 1280, height = 720): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buffer: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const band = Math.floor(x / 160) % 2 === 0 ? 1 : 0.86; // soft vertical stripes
      const header = y < 56 ? 0.7 : 1; // a darker "title bar"
      row[1 + x * 3] = Math.round(r * band * header);
      row[2 + x * 3] = Math.round(g * band * header);
      row[3 + x * 3] = Math.round(b * band * header);
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(Buffer.concat(rows))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing to touch a database on "${host}". Sample content is for the local database only.`);
  }
  console.log(`Database: ${new URL(url).pathname.slice(1)} on ${host}`);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const storage = createLocalStorage(process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads"));

// ---- add / remove --------------------------------------------------------------------------------------------

async function add() {
  if (existsSync(BACKUP)) throw new Error(`${BACKUP} exists: sample content is already applied. Run "npm run sample:remove" first.`);
  const db = connect();
  try {
    // Profile and settings: fill only the fields that are still empty, and remember which ones.
    const profile = await db.profile.findUnique({ where: { id: "singleton" } });
    const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
    const filledProfile = Object.entries(PROFILE).filter(([key]) => !(profile as Record<string, unknown> | null)?.[key]);
    const filledSettings = Object.entries(SETTINGS).filter(([key]) => !(settings as Record<string, unknown> | null)?.[key]);
    await db.profile.upsert({ where: { id: "singleton" }, update: Object.fromEntries(filledProfile), create: { id: "singleton", ...Object.fromEntries(filledProfile) } });
    await db.siteSettings.upsert({ where: { id: "singleton" }, update: Object.fromEntries(filledSettings), create: { id: "singleton", ...Object.fromEntries(filledSettings) } });

    // Technologies: reuse yours when the name already exists, otherwise create a sample one.
    const technologyIds = new Map<string, string>();
    for (const [index, tech] of TECHNOLOGIES.entries()) {
      const existing = await db.technology.findFirst({ where: { OR: [{ name: { equals: tech.name, mode: "insensitive" } }, { slug: slugOf(tech.name) }] } });
      if (existing) {
        technologyIds.set(tech.name, existing.id);
        continue;
      }
      const created = await db.technology.create({
        data: { id: `${PREFIX}tech-${slugOf(tech.name)}`, name: tech.name, slug: slugOf(tech.name), category: tech.category, isKeySkill: tech.key, sortOrder: index },
      });
      technologyIds.set(tech.name, created.id);
    }

    for (const [index, item] of EXPERIENCE.entries()) {
      await db.experience.create({
        data: { id: `${PREFIX}exp-${index}`, company: item.company, role: item.role, location: item.location, startDate: monthDate(item.start), endDate: item.end ? monthDate(item.end) : null, description: item.description, status: "PUBLISHED" },
      });
    }
    for (const [index, item] of EDUCATION.entries()) {
      await db.education.create({
        data: { id: `${PREFIX}edu-${index}`, institution: item.institution, degree: item.degree, field: item.field, startDate: monthDate(item.start), endDate: monthDate(item.end), description: item.description, status: "PUBLISHED" },
      });
    }

    for (const item of PROJECTS) {
      const project = await db.project.create({
        data: {
          id: `${PREFIX}project-${item.slug.replace(PREFIX, "")}`, slug: item.slug, title: item.title, summary: item.summary,
          overview: item.overview, problem: item.problem, solution: item.solution, architecture: item.architecture,
          implementation: item.implementation, challenges: item.challenges, results: item.results,
          repoUrl: item.repoUrl, liveUrl: item.liveUrl, status: item.status, featured: item.featured, sortOrder: item.order,
          publishedAt: item.status === "PUBLISHED" ? new Date() : null,
          technologies: { create: item.tech.map((name) => ({ technologyId: technologyIds.get(name)! })) },
        },
      });
      if (item.status === "PUBLISHED") {
        // Two placeholder images each, so cards and the gallery can be judged.
        for (const [position, shade] of [1, 0.8].entries()) {
          const color = item.color.map((value) => Math.round(value * shade)) as [number, number, number];
          const stored = await storage.put(`images/${randomUUID()}.png`, placeholderPng(color), "image/png");
          await db.projectMedia.create({
            data: { id: `${PREFIX}media-${item.slug.replace(PREFIX, "")}-${position}`, projectId: project.id, url: stored.url, alt: `Placeholder image ${position + 1} for the sample project ${item.title}`, sortOrder: position },
          });
        }
      }
    }

    writeFileSync(BACKUP, JSON.stringify({ filledProfile: filledProfile.map(([key]) => key), filledSettings: filledSettings.map(([key]) => key) }, null, 2));
    console.log("Sample content added.");
    console.log(`  profile fields filled: ${filledProfile.map(([key]) => key).join(", ") || "none (all were already set)"}`);
    console.log(`  technologies: ${TECHNOLOGIES.length} (yours reused when the name matched), experience: ${EXPERIENCE.length}, education: ${EDUCATION.length}, projects: ${PROJECTS.length}`);
    console.log('Remove it any time with: npm run sample:remove');
  } finally {
    await db.$disconnect();
  }
}

async function remove() {
  if (!existsSync(BACKUP)) throw new Error(`${BACKUP} not found: nothing to restore. (Sample rows can still be found by the "${PREFIX}" id prefix.)`);
  const backup = JSON.parse(readFileSync(BACKUP, "utf8")) as { filledProfile: string[]; filledSettings: string[] };
  const db = connect();
  try {
    // Files first (their URLs live on the media rows that are about to disappear).
    const media = await db.projectMedia.findMany({ where: { id: { startsWith: PREFIX } }, select: { url: true } });
    await Promise.allSettled(media.map((item) => storage.remove(item.url)));

    const removed = {
      projects: (await db.project.deleteMany({ where: { id: { startsWith: PREFIX } } })).count,
      technologies: (await db.technology.deleteMany({ where: { id: { startsWith: PREFIX } } })).count,
      experience: (await db.experience.deleteMany({ where: { id: { startsWith: PREFIX } } })).count,
      education: (await db.education.deleteMany({ where: { id: { startsWith: PREFIX } } })).count,
    };
    await db.profile.updateMany({ where: { id: "singleton" }, data: Object.fromEntries(backup.filledProfile.map((key) => [key, null])) });
    await db.siteSettings.updateMany({ where: { id: "singleton" }, data: Object.fromEntries(backup.filledSettings.map((key) => [key, null])) });

    rmSync(BACKUP);
    console.log("Sample content removed.", removed, `images deleted: ${media.length}`);
    console.log(`  profile fields cleared again: ${backup.filledProfile.join(", ") || "none"}`);
  } finally {
    await db.$disconnect();
  }
}

const command = process.argv[2];
if (command === "add") await add();
else if (command === "remove") await remove();
else {
  console.error('Usage: sample-content.ts add | remove');
  process.exit(1);
}
