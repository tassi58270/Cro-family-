import { expect, test } from "@playwright/test";
import { expectAccessible, hasDatabase, signIn } from "./helpers";

/** Step 9: the map, the timeline and their two-way link (6.6). */

test("the places page has no detectable accessibility issue", async ({
  page,
}) => {
  await page.goto("/fr/lieux-et-evenements");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lieux et événements" }),
  ).toBeVisible();
  await expectAccessible(page);
});

test.describe("with places entered in the dashboard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({ isMobile }) => {
    test.skip(!hasDatabase, "needs DATABASE_URL");
    test.skip(isMobile, "writes to the shared database: desktop project only");
  });

  test("an administrator places Azincourt on the map and dates an event there", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/fr/admin/lieux");
    await page.getByRole("button", { name: "Ajouter un lieu" }).click();
    const panel = page.getByRole("dialog");
    await panel.getByLabel("Nom du lieu").first().fill("Azincourt");
    await panel.getByLabel("Type").selectOption("battlefield");
    await panel.getByLabel("Coordonnées").fill("50.46, 2.13");
    await panel.getByRole("button", { name: "Enregistrer" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByText("Azincourt", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Ajouter un événement" }).click();
    await panel
      .getByLabel("Titre de l’événement")
      .first()
      .fill("Bataille d’essai");
    await panel.getByLabel("Date").fill("1415");
    await expect(panel.getByText("Compris : 1415")).toBeVisible();
    await panel.getByLabel("Type").selectOption("battle");
    await panel.getByLabel("Lieu").selectOption({ label: "Azincourt" });
    await panel.getByRole("button", { name: "Enregistrer" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByText("Bataille d’essai")).toBeVisible();
  });

  test("a click on Azincourt shows 1415 on the timeline, and the reverse", async ({
    page,
  }) => {
    const marker = page.locator('.map-marker[aria-label="Azincourt"]');
    await expect(async () => {
      await page.goto("/fr/lieux-et-evenements");
      await expect(marker).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // The place lights up its events on the timeline.
    await marker.click();
    const card = page.getByRole("region", { name: "Azincourt" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: /1415/ })).toBeVisible();
    const item = page.locator("[data-event]", { hasText: "Bataille d’essai" });
    await expect(item).toHaveAttribute("data-highlight", "true");
    await expect(item).toContainText("1415");
    await expect(item).toBeInViewport();
    await expect(page).toHaveURL(/lieu=azincourt/);
    await expectAccessible(page);

    // The event takes the map to its place.
    await page.goto("/fr/lieux-et-evenements");
    await page
      .locator("[data-event]", { hasText: "Bataille d’essai" })
      .getByRole("button")
      .click();
    await expect(marker).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("region", { name: "Azincourt" })).toBeVisible();
    await expect(page).toHaveURL(/evenement=bataille-dessai-1415/);
  });

  test("the place has its own page, which leads back to the map", async ({
    page,
  }) => {
    await page.goto("/fr/lieux/azincourt");
    await expect(
      page.getByRole("heading", { level: 1, name: "Azincourt" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /1415\s*Bataille d’essai/ }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Voir sur la carte" }).click();
    await expect(page).toHaveURL(/lieux-et-evenements\?lieu=azincourt/);
    await expect(page.getByRole("region", { name: "Azincourt" })).toBeVisible();
  });
});
