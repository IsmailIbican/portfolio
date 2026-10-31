import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { MIN_FORM_AGE_MS } from "../../src/features/contact/protection";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./env";

export async function signIn(page: Page, password = ADMIN_PASSWORD) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signInAndWait(page: Page) {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}

/**
 * WCAG 2.2 A/AA check of the page as it is now. Motion is reduced first so a fade-in in progress cannot make the
 * colour-contrast check read half-transparent text.
 */
export async function expectNoAccessibilityViolations(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
  expect(summary, `Accessibility violations on ${page.url()}`).toEqual([]);
}

export async function fillContactForm(page: Page, { name, email, message }: { name: string; email: string; message: string }) {
  await page.goto("/contact");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Message").fill(message);
}

/**
 * The server refuses a form that was open for less than MIN_FORM_AGE_MS (scripts post instantly, people do not), and that
 * clock runs on the server, so it cannot be skipped from the browser. A visitor needs this long anyway.
 */
export async function sendContactMessage(page: Page, fields: { name: string; email: string; message: string }) {
  await fillContactForm(page, fields);
  await page.waitForTimeout(MIN_FORM_AGE_MS + 500);
  await page.getByRole("button", { name: "Send message" }).click();
}
