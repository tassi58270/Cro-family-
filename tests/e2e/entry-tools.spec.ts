import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectAccessible, hasDatabase, signIn } from "./helpers";

/**
 * Step 4: sign-in, direct entry in the tree, demonstration family, GEDCOM
 * import. These tests share one database, so they run one after the other,
 * on the desktop project only.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(({ isMobile }) => {
  test.skip(!hasDatabase, "needs DATABASE_URL");
  test.skip(isMobile, "writes to the shared database: desktop project only");
});

test("private areas send visitors to the sign-in page", async ({ page }) => {
  await page.goto("/fr/admin");
  await expect(page).toHaveURL(/\/fr\/connexion$/);
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("an unknown address receives no link, and the page does not say why", async ({
  page,
}) => {
  await page.goto("/fr/connexion");
  await page.getByLabel("Votre adresse e-mail").fill("inconnu@example.org");
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(page.getByText("Regardez votre boîte e-mail")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ouvrir le lien de connexion" }),
  ).toHaveCount(0);
});

test("the sign-in page has no detectable accessibility issue", async ({
  page,
}) => {
  await page.goto("/fr/connexion");
  await expectAccessible(page);
});

test("an administrator signs in with the emailed link, which works only once", async ({
  page,
  context,
}) => {
  const link = await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour");
  await expectAccessible(page);

  await context.clearCookies();
  await page.goto(link);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page.getByText("Ce lien n’est plus valable")).toBeVisible();
});

test("a non-technical person adds three generations in under five minutes", async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  await signIn(page);
  const start = Date.now();
  await page.goto("/fr/admin/arbre");

  await page
    .getByRole("button", { name: "Ajouter une personne" })
    .first()
    .click();
  await page.getByLabel("Prénoms").fill("Paul");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur");
  await page.getByLabel("Naissance", { exact: true }).fill("vers 1900");
  await expect(page.getByText("Compris : vers 1900")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Paul Testeur" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel("Prénoms").fill("Jeanne");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur");
  await page.getByLabel("Naissance", { exact: true }).fill("12 mars 1930");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("link", { name: /Jeanne Testeur/ }).click();
  await expect(
    page.getByRole("heading", { name: "Jeanne Testeur" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel("Prénoms").fill("Luc");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur");
  await page.getByLabel("Naissance", { exact: true }).fill("1960");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("link", { name: /Luc Testeur/ })).toBeVisible();

  // Jeanne has her father above her and her son below.
  await expect(page.getByRole("link", { name: /Paul Testeur/ })).toBeVisible();
  expect(Date.now() - start).toBeLessThan(5 * 60_000);
});

test("a date that cannot be understood is said so, and nothing is lost", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/fr/admin/arbre");
  await page.getByRole("button", { name: "Ajouter un enfant" }).first().click();
  await page.getByLabel("Prénoms").fill("Anne");
  await page.getByLabel("Naissance", { exact: true }).fill("un jour de pluie");
  await expect(page.getByText("Date non comprise").first()).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Prénoms")).toHaveValue("Anne");
});

test("the demonstration family is flagged everywhere and leaves in one click", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/fr/admin/demonstration");
  await page
    .getByRole("button", { name: "Charger la famille « Exemple »" })
    .click();
  await expect(
    page.getByText("La famille « Exemple » est chargée."),
  ).toBeVisible();

  await page.goto("/fr/photos");
  await expect(page.getByRole("note")).toContainText(
    "Données de démonstration",
  );

  await page.goto("/fr/admin/demonstration");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Supprimer les données de démonstration" })
    .click();
  await expect(page.getByText("Aucune donnée de démonstration.")).toBeVisible();

  await expect(async () => {
    await page.goto("/fr/photos");
    await expect(page.getByRole("note")).toHaveCount(0);
  }).toPass({ timeout: 10_000 });
});

test("a GEDCOM file is analysed, then imported", async ({ page }) => {
  await signIn(page);
  await page.goto("/fr/admin/import");
  await page
    .getByLabel("Fichier GEDCOM")
    .setInputFiles(path.join(__dirname, "..", "fixtures", "exemple.ged"));
  await page.getByRole("button", { name: "Analyser le fichier" }).click();
  await expect(
    page.getByRole("heading", { name: "Contenu de exemple.ged" }),
  ).toBeVisible();
  await expect(page.getByText("1 date n’a pas été comprise")).toBeVisible();

  await page.getByRole("button", { name: "Importer 4 personnes" }).click();
  await expect(
    page.getByRole("heading", { name: "Import terminé" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voir l’arbre" }).click();
  await expect(page).toHaveURL(/\/fr\/admin\/arbre$/);
});
