import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

/** Step 8: the Photos page, whatever the family has sent so far. */

test("the photos page has no detectable accessibility issue", async ({
  page,
}) => {
  await page.goto("/fr/photos");
  await expect(
    page.getByRole("heading", { level: 1, name: "Photos" }),
  ).toBeVisible();
  await expectAccessible(page);
});

test("files are only served when their photo may be seen", async ({
  request,
}) => {
  const missing = await request.get("/fichiers/photos/2026/inexistante.jpg");
  expect(missing.status()).toBe(404);
  const escape = await request.get("/fichiers/..%2F..%2Fetc%2Fpasswd");
  expect(escape.status()).toBe(404);
});

test("sending photos asks visitors to sign in first", async ({ page }) => {
  await page.goto("/fr/compte/photos");
  await expect(page).toHaveURL(/\/fr\/connexion/);
});
