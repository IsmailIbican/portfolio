import { expect, test } from "@playwright/test";
import { fillContactForm, sendContactMessage } from "./helpers";

const VISITOR = { name: "Contact Visitor", email: "contact@example.com", message: "A short note from the contact test." };

test("the contact form asks for every field before it sends anything", async ({ page }) => {
  await page.goto("/contact");
  for (const label of ["Name", "Email", "Message"]) {
    await expect(page.getByLabel(label)).toHaveAttribute("required", "");
  }
  // Without Turnstile configured the widget is absent.
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("the spam trap is hidden from assistive technology and from the tab order", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("textbox", { name: "Leave this field empty" })).toHaveCount(0);
  await expect(page.locator('input[name="contact_ref_2"]')).toHaveAttribute("tabindex", "-1");
});

test("a visitor can send a message and gets a clear confirmation", async ({ page }) => {
  await sendContactMessage(page, VISITOR);
  await expect(page.getByRole("status").filter({ hasText: "Thank you" })).toBeVisible();
});

test("a form posted instantly, the way a script would, is refused", async ({ page }) => {
  await fillContactForm(page, { ...VISITOR, message: "Posted too fast to be a person." });
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Please reload the page" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Thank you" })).toHaveCount(0);
});
