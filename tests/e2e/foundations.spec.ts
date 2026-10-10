import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
}

const homes = [
  { locale: "fr", title: "Neuf siècles d’une famille européenne" },
  { locale: "en", title: "Nine centuries of a European family" },
  { locale: "de", title: "Neun Jahrhunderte einer europäischen Familie" },
] as const;

test.describe("the three languages", () => {
  for (const { locale, title } of homes) {
    test(`/${locale} answers in its language`, async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    });

    test(`/${locale} has no detectable accessibility issue`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expectAccessible(page);
    });
  }

  test.describe("dark mode", () => {
    test.use({ colorScheme: "dark" });
    for (const path of ["/fr", "/fr/nexiste-pas"]) {
      test(`${path} has no detectable accessibility issue`, async ({
        page,
      }) => {
        await page.goto(path);
        await expectAccessible(page);
      });
    }
  });

  test("the language switcher keeps the visitor on the same page", async ({
    page,
  }) => {
    await page.goto("/fr");
    await page.getByRole("link", { name: "en", exact: true }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      homes[1].title,
    );
  });
});

test.describe("language detection", () => {
  test.describe("German browser", () => {
    test.use({ locale: "de-DE" });
    test("/ leads to /de", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/de$/);
    });
  });

  test.describe("unsupported language", () => {
    test.use({ locale: "ja-JP" });
    test("/ falls back to French", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/fr$/);
    });
  });
});

test("URL segments are translated per language", async ({ request }) => {
  const response = await request.get("/en/arbre", { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["location"]).toMatch(/\/en\/family-tree$/);
});

test("unknown addresses get a translated 404", async ({ page }) => {
  const response = await page.goto("/de/gibt-es-nicht");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Seite nicht gefunden",
  );
});

test("the skip link is the first thing the keyboard reaches", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "keyboard navigation is checked on desktop");
  await page.goto("/fr");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu principal" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

test.describe("until launch, nothing is indexed", () => {
  test("robots.txt disallows everything", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toMatch(/Disallow: \/\s*$/m);
  });

  test("pages say noindex", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});

test("security headers are sent", async ({ request }) => {
  const headers = (await request.get("/fr")).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});
