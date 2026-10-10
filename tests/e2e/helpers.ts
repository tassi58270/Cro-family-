import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@example.org";

/** Tests that write to the database need one, with dev sign-in links. */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

/**
 * Signs in through the real form. Without an email service, the link that
 * would be emailed is shown on screen (AUTH_DEV_LINKS=on).
 */
export async function signIn(page: Page, email = ADMIN_EMAIL) {
  await page.goto("/fr/connexion");
  await page.getByLabel("Votre adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  const link = page.getByRole("link", { name: "Ouvrir le lien de connexion" });
  const href = await link.getAttribute("href");
  await link.click();
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL(/\/(admin|compte)$/);
  return new URL(href!).pathname + new URL(href!).search;
}
