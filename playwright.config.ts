import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/env";

const baseURL = `http://localhost:${E2E_PORT}`;

// Runs against `next start` (the production build, with the strict CSP enforced), so `npm run build` must come first:
// `npm run test:e2e` does both. The site talks to a throwaway database (see tests/e2e/global-setup.ts).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // One database, state built up by earlier steps: tests run one at a time, in order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${E2E_PORT}`,
    // Playwright starts the server before global setup creates the database, so readiness is judged on a page that needs none.
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_URL: baseURL,
      // Switch off everything that would talk to a real service or that the developer's .env.local might turn on.
      STORAGE_DRIVER: "local",
      BLOB_PUBLIC_HOST: "",
      CRON_SECRET: "",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      EMAIL_PROVIDER_API_KEY: "",
      CONTACT_TO_EMAIL: "",
      EMAIL_FROM: "",
      GITHUB_TOKEN: "",
    },
  },
});
