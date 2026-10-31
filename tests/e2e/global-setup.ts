import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { ADMIN_EMAIL, ADMIN_PASSWORD, E2E_DATABASE_URL } from "./env";

interface PgClient {
  connect(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, string>> }>;
  end(): Promise<void>;
}
const { Client } = createRequire(import.meta.url)("pg") as { Client: new (options: { connectionString: string }) => PgClient };

function run(command: string, args: string[], extraEnv: Record<string, string>) {
  const result = spawnSync(command, args, { env: { ...process.env, ...extraEnv }, shell: true, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
}

/**
 * Prepares a database that exists only for the E2E run: created if missing, migrated, emptied, seeded with one admin.
 * It empties tables, so it refuses any database whose name does not end with "_e2e".
 */
export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_e2e$/.test(name)) throw new Error(`Refusing to run E2E: database name "${name}" must end with _e2e.`);

  const maintenance = new URL(E2E_DATABASE_URL);
  maintenance.pathname = "/postgres";
  const admin = new Client({ connectionString: maintenance.toString() });
  await admin.connect();
  try {
    const exists = await admin.query("select 1 as found from pg_database where datname = $1", [name]);
    if (exists.rows.length === 0) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: E2E_DATABASE_URL });

  const db = new Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
  try {
    const tables = await db.query("select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'");
    if (tables.rows.length > 0) {
      const list = tables.rows.map((row) => `"${row.tablename}"`).join(", ");
      await db.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await db.end();
  }

  run("npx", ["tsx", "prisma/seed.ts"], { DATABASE_URL: E2E_DATABASE_URL, ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD: ADMIN_PASSWORD });
}
