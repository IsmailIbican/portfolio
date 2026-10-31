import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./helpers";

const PAGES = [
  { path: "/", link: "Home" },
  { path: "/projects", link: "Projects" },
  { path: "/about", link: "About" },
  { path: "/tech-stack", link: "Tech Stack" },
  { path: "/contact", link: "Contact" },
];

test("visitors can reach every public page from the main navigation", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });

  for (const { path, link } of PAGES) {
    await nav.getByRole("link", { name: link }).click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(nav.getByRole("link", { name: link })).toHaveAttribute("aria-current", "page");
  }
});

test("an unknown address gives a 404, not a blank page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("pages are served with a strict CSP and the standard security headers", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toMatch(/script-src [^;]*'nonce-[^']+'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the draft-only admin area is not reachable without signing in", async ({ page }) => {
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${colorScheme} theme)`, () => {
    test.use({ colorScheme });

    for (const { path } of [...PAGES, { path: "/admin/login" }]) {
      test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached();
        await expectNoAccessibilityViolations(page);
      });
    }
  });
}
