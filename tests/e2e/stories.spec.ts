import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

/** Step 8: the stories page reads well whatever the family has written. */

test("the stories page invites to write and has no detectable accessibility issue", async ({
  page,
}) => {
  await page.goto("/fr/histoires");
  await expect(
    page.getByRole("heading", { level: 1, name: "Histoires" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Raconter une histoire" }).first(),
  ).toBeVisible();
  await expectAccessible(page);
});

test("writing a story asks visitors to sign in first", async ({ page }) => {
  await page.goto("/fr/compte/histoires/nouvelle");
  await expect(page).toHaveURL(/\/fr\/connexion/);
});
