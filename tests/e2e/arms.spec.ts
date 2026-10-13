import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

/**
 * Step 7: the arms page explains the first arms step by step and stays
 * readable whatever the family has entered yet.
 */

test("the arms are explained step by step as the page scrolls", async ({
  page,
}) => {
  await page.goto("/fr/armoiries");
  await expect(
    page.getByRole("heading", { level: 1, name: "Armoiries et branches" }),
  ).toBeVisible();
  const shield = page.locator("[data-stage]");
  await expect(shield).toHaveAttribute("data-stage", "0");
  await page
    .getByRole("heading", { name: /Trois fasces de gueules/ })
    .scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 150);
  await expect(shield).toHaveAttribute("data-stage", /[12]/);
  await page
    .getByRole("heading", { name: /Écartelé avec Renty/ })
    .scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 150);
  await expect(shield).toHaveAttribute("data-stage", "2");
  await expect(shield).toHaveAccessibleName("Écu écartelé de Croÿ et de Renty");
});

test("every heraldic word opens its meaning", async ({ page }) => {
  await page.goto("/fr/armoiries");
  await page.getByRole("button", { name: "gueules" }).click();
  await expect(
    page.getByText("Le rouge, dans le vocabulaire des armoiries."),
  ).toBeVisible();
});

test("the arms page has no detectable accessibility issue", async ({
  page,
}) => {
  await page.goto("/fr/armoiries");
  await expectAccessible(page);
});
