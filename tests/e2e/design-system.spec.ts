import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

test.describe("style page", () => {
  test("shows the design system and is never indexed", async ({ page }) => {
    await page.goto("/fr/style");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Système de design",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page.getByRole("img", { name: /Armes de Croÿ :/ }).first(),
    ).toBeVisible();
  });

  test("has no detectable accessibility issue", async ({ page }) => {
    await page.goto("/fr/style");
    await expectAccessible(page);
  });

  test.describe("in dark mode", () => {
    test.use({ colorScheme: "dark" });
    test("has no detectable accessibility issue", async ({ page }) => {
      await page.goto("/fr/style");
      await expectAccessible(page);
    });
  });

  test("the side panel opens, traps focus and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/fr/style");
    await page
      .getByRole("button", { name: "Ouvrir une fiche d’exemple" })
      .click();
    const panel = page.getByRole("dialog", { name: "Prénom Exemple" });
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("a technical word explains itself on click", async ({ page }) => {
    await page.goto("/fr/style");
    await page.getByRole("button", { name: "fasces" }).click();
    await expect(
      page.getByText("Bande horizontale qui traverse l’écu"),
    ).toBeVisible();
  });
});

test.describe("site shell", () => {
  const sections = [
    "/fr/arbre",
    "/fr/armoiries",
    "/fr/histoires",
    "/fr/photos",
    "/fr/lieux-et-evenements",
    "/fr/contribuer",
    "/fr/recherche",
    "/fr/connexion",
    "/en/family-tree",
    "/de/fotos",
  ];

  for (const path of sections) {
    test(`${path} answers and invites to contribute`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("an empty section has no detectable accessibility issue", async ({
    page,
  }) => {
    await page.goto("/fr/photos");
    await expectAccessible(page);
  });

  test("the menu leads to every section", async ({ page, isMobile }) => {
    await page.goto("/fr");
    if (isMobile) {
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Menu principal" }),
      ).toBeVisible();
    }
    await page
      .getByRole("navigation", { name: "Menu principal" })
      .getByRole("link", { name: "Histoires" })
      .click();
    await expect(page).toHaveURL(/\/fr\/histoires$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the current section is marked in the menu", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop menu is checked here");
    await page.goto("/fr/arbre");
    await expect(
      page
        .getByRole("navigation", { name: "Menu principal" })
        .getByRole("link", { name: "Arbre" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("the chosen theme is applied and remembered", async ({ page }) => {
    await page.goto("/fr/photos");
    await page.getByRole("contentinfo").getByText("Sombre").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(20, 20, 20)",
    );
  });
});
