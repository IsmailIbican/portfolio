// Uploads production environment variables from secrets.production.env to the Vercel project.
// Values are passed to the CLI through stdin, never as arguments, and are never printed.
//
//   node scripts/upload-prod-env.mjs           shows what would be uploaded (names only)
//   node scripts/upload-prod-env.mjs --apply   uploads
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROJECT = "ismail-ibican";
const SITE_URL = "https://ismail-ibican.vercel.app";
const BLOB_PUBLIC_HOST = "ufynahxy6bqfyqtx.public.blob.vercel-storage.com";

/** Read by the running site. ADMIN_* (seed only) and DIRECT_URL (migrations only) stay on this machine. */
const UPLOAD_FROM_FILE = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "EMAIL_PROVIDER_API_KEY",
  "CONTACT_TO_EMAIL",
  "EMAIL_FROM",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];

/** Stored as Sensitive: the dashboard and CLI can never show them again. */
const SENSITIVE = new Set(["DATABASE_URL", "AUTH_SECRET", "EMAIL_PROVIDER_API_KEY", "TURNSTILE_SECRET_KEY"]);

/** Not secrets. NEXT_PUBLIC_SITE_URL is inlined at build time, so it must exist before the first build. */
const FIXED = {
  AUTH_URL: SITE_URL,
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  STORAGE_DRIVER: "blob",
  BLOB_PUBLIC_HOST,
};

const fromFile = {};
for (const line of readFileSync("secrets.production.env", "utf8").split(/\r?\n/)) {
  if (/^\s*#/.test(line)) continue;
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); // tolerates "NAME =value"
  if (match) fromFile[match[1]] = match[2];
}

const entries = [];
const problems = [];
for (const name of UPLOAD_FROM_FILE) {
  const value = fromFile[name];
  if (!value) problems.push(`${name} is missing or empty in secrets.production.env`);
  else entries.push({ name, value, sensitive: SENSITIVE.has(name) });
}
if (fromFile.AUTH_SECRET && fromFile.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET is shorter than 32 characters");
for (const [name, value] of Object.entries(FIXED)) entries.push({ name, value, sensitive: false });

if (problems.length > 0) {
  console.error(problems.map((p) => `PROBLEM: ${p}`).join("\n"));
  process.exit(1);
}

const apply = process.argv.includes("--apply");
for (const { name, value, sensitive } of entries) {
  const kind = sensitive ? "sensitive" : "plain    ";
  if (!apply) {
    console.log(`would upload  ${kind}  ${name}`);
    continue;
  }
  const args = ["env", "add", name, "--environment", "production", "--project", PROJECT, "--force", "--yes", sensitive ? "--sensitive" : "--no-sensitive"];
  const result = spawnSync("vercel", args, { input: value, encoding: "utf8", shell: true });
  if (result.status === 0) {
    console.log(`uploaded      ${kind}  ${name}`);
  } else {
    const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.split(value).join("***").trim().split("\n").slice(-2).join(" | ");
    console.error(`FAILED        ${kind}  ${name}: ${detail}`);
    process.exit(1);
  }
}
