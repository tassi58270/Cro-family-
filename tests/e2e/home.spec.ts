import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

/** Home page (cahier des charges 6.1 and step 5). */

test.describe("the opening", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("plays in under 3 seconds, then once per session only", async ({
    page,
  }) => {
    await page.goto("/fr");
    const html = page.locator("html");
    // Timed from the first band, once the fonts are there.
    await expect(html).toHaveClass(/intro-motion/);
    const start = Date.now();
    await expect(html).not.toHaveClass(/intro/, { timeout: 5_000 });
    expect(Date.now() - start).toBeLessThan(3_000);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "Croÿ",
    );

    await page.reload();
    await expect(html).not.toHaveClass(/intro/);
  });

  test("a click speeds it to its end", async ({ page }) => {
    await page.goto("/fr");
    const html = page.locator("html");
    await expect(html).toHaveClass(/intro-motion/);
    await page.mouse.click(10, 300);
    const start = Date.now();
    await expect(html).not.toHaveClass(/intro/, { timeout: 3_000 });
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  test("a phone too slow to start it shows the page at once", async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 10 });
    const start = Date.now();
    await page.goto("/fr", { waitUntil: "commit" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Croÿ" }),
    ).toBeVisible({ timeout: 4_000 });
    expect(Date.now() - start).toBeLessThan(4_000);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await expect(page.locator("html")).not.toHaveClass(/intro/);
  });

  test("does not play on other pages", async ({ page }) => {
    await page.goto("/fr/histoires");
    await expect(page.locator("html")).not.toHaveClass(/intro/);
  });
});

test.describe("with reduced motion", () => {
  test("everything is there at once, the dots of the ÿ in red", async ({
    page,
  }) => {
    await page.goto("/fr");
    await expect(page.locator("html")).not.toHaveClass(/intro/);
    await expect(
      page.getByText("Neuf siècles d’une famille européenne"),
    ).toBeVisible();
    await expect(
      page.locator(".opening").getByText("se prononce"),
    ).toBeVisible();
    await expect(page.locator(".opening .dot").first()).toHaveCSS(
      "color",
      "rgb(200, 16, 46)",
    );
    await expect(page.getByRole("heading", { name: "Explorer" })).toBeVisible();
  });

  test("has no detectable accessibility issue", async ({ page }) => {
    await page.goto("/fr");
    await expectAccessible(page);
  });
});

test("every section can be reached from the tiles", async ({ page }) => {
  await page.goto("/fr");
  const tiles = page.locator("#explorer li");
  await expect(tiles).toHaveCount(6);
  await tiles.filter({ hasText: "Photos" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/fr\/photos$/);
});

test("the home page fits the width of a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone width only");
  await page.goto("/fr");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
