import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations, sendContactMessage, signIn, signInAndWait } from "./helpers";

test("signing in with a wrong password is refused with a generic message", async ({ page }) => {
  await signIn(page, "definitely-the-wrong-password");
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the admin can sign in, see the overview and sign out again", async ({ page }) => {
  await signInAndWait(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  // Wait for the sign-out to finish before asking for /admin again, otherwise the request races the cookie being cleared.
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("the main admin pages have no WCAG 2.2 AA violations", async ({ page }) => {
  await signInAndWait(page);
  for (const path of ["/admin", "/admin/projects", "/admin/projects/new", "/admin/profile", "/admin/messages", "/admin/technologies"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  }
});

test("a published project shows up on the site, and disappears when it is deleted", async ({ page }) => {
  await signInAndWait(page);

  await page.goto("/admin/projects/new");
  await page.getByLabel("Title").fill("E2E Project");
  await page.getByLabel("Summary").fill("A project created by the end-to-end test.");
  await page.getByLabel("Visibility").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "E2E Project" })).toBeVisible();
  const editUrl = page.url();
  expect(editUrl).toMatch(/\/admin\/projects\/[^/]+$/);

  await page.goto("/projects");
  await page.getByRole("link", { name: "E2E Project" }).click();
  await expect(page).toHaveURL(/\/projects\/e2e-project$/);
  await expect(page.getByRole("heading", { level: 1, name: "E2E Project" })).toBeVisible();

  await page.goto(editUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project E2E Project" }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);

  const gone = await page.goto("/projects/e2e-project");
  expect(gone?.status()).toBe(404);
});

test("a draft project stays hidden from visitors", async ({ page, browser }) => {
  await signInAndWait(page);
  await page.goto("/admin/projects/new");
  await page.getByLabel("Title").fill("E2E Draft");
  await page.getByLabel("Summary").fill("Not ready to be shown.");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Draft" })).toBeVisible();
  const editUrl = page.url();

  // A visitor with no session must not find it, neither in the list nor by its address.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/projects");
  await expect(visitorPage.getByText("E2E Draft")).toHaveCount(0);
  const direct = await visitorPage.goto("/projects/e2e-draft");
  expect(direct?.status()).toBe(404);
  await visitor.close();

  await page.goto(editUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project E2E Draft" }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
});

test("a message sent through the contact form reaches the admin Messages page", async ({ page }) => {
  await sendContactMessage(page, { name: "E2E Visitor", email: "visitor@example.com", message: "Hello from the end-to-end test." });
  await expect(page.getByText("Thank you. Your message was sent")).toBeVisible();

  await signInAndWait(page);
  await page.goto("/admin/messages");
  const message = page.locator("details", { hasText: "E2E Visitor" });
  await message.locator("summary").click();
  await expect(message.getByText("Hello from the end-to-end test.")).toBeVisible();

  await message.getByRole("button", { name: "Mark as read" }).click();
  await expect(message.locator("summary")).toContainText("Read");
  // The page re-renders after the update; the message the admin is working on must not fold shut under them.
  await expect.poll(() => message.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete message from E2E Visitor" }).click();
  await expect(page.getByText("No messages here.")).toBeVisible();
});
