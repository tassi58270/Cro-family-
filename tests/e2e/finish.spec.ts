import { expect, test } from "@playwright/test";
import pg from "pg";
import { expectAccessible, hasDatabase, signIn } from "./helpers";

/** Step 12: search, error pages and what search engines and shares read. */

test("an unknown address shows a 404 that leads somewhere", async ({
  page,
}) => {
  const response = await page.goto("/fr/une-adresse-inconnue");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page introuvable" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Chercher sur le site" }).click();
  await expect(page).toHaveURL(/\/fr\/recherche$/);
  await expect(page.getByLabel("Que cherchez-vous ?")).toBeFocused();
});

test("the search page says when nothing matches", async ({ page }) => {
  await page.goto("/fr/recherche?q=zzzzqq");
  await expect(page.getByLabel("Que cherchez-vous ?")).toHaveValue("zzzzqq");
  await expect(page.getByText(/Rien ne correspond à/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Proposer un ajout" }),
  ).toBeVisible();
  await expectAccessible(page);
});

test("each page is its own canonical, with its translations", async ({
  page,
}) => {
  await page.goto("/fr/arbre");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/fr\/arbre$/,
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="de"]'),
  ).toHaveAttribute("href", /\/de\/stammbaum$/);
  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  const response = await page.request.get(image!);
  expect(response.headers()["content-type"]).toBe("image/png");
});

test.describe("searching the family", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!hasDatabase, "needs DATABASE_URL");
    test.skip(isMobile, "writes to the shared database: desktop project only");
  });

  test("finds people whatever the accents, living relatives for members only", async ({
    page,
  }) => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      await db.query(
        "delete from public.people where slug in ('helene-recherche', 'cousin-recherche')",
      );
      await db.query(
        `insert into public.people (slug, given_names, surname, birth_date, birth_precision, deceased, status) values
         ('helene-recherche', 'Hélène', 'Recherché', '1801-01-01', 'year', true, 'published'),
         ('cousin-recherche', 'Cousin', 'Recherché', '1995-01-01', 'year', false, 'published')`,
      );
    } finally {
      await db.end();
    }

    await signIn(page);
    await page.goto("/fr/recherche");
    await page.getByLabel("Que cherchez-vous ?").fill("helene recherche");
    const people = page.getByRole("region", { name: /Personnes/ });
    await expect(
      people.getByRole("link", { name: /Hélène Recherché/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/q=helene\+recherche/);

    // A member sees the living cousin; the public index never has him.
    await page.getByLabel("Que cherchez-vous ?").fill("cousin recherche");
    await expect(
      people.getByRole("link", { name: /Cousin Recherché/ }),
    ).toBeVisible();
    const index = await (await page.request.get("/api/recherche/fr")).text();
    expect(index).not.toContain("cousin-recherche");
    await expectAccessible(page);

    await people.getByRole("link", { name: /Cousin Recherché/ }).click();
    await expect(page).toHaveURL(/\/fr\/arbre\/cousin-recherche$/);
  });
});
