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
  await page.getByLabel("Nom", { exact: true }).first().fill("Testeur");
  await page.getByLabel("Naissance", { exact: true }).fill("vers 1900");
  await expect(page.getByText("Compris : vers 1900")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Paul Testeur" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel("Prénoms").fill("Jeanne");
  await page.getByLabel("Nom", { exact: true }).first().fill("Testeur");
  await page.getByLabel("Naissance", { exact: true }).fill("12 mars 1930");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("link", { name: /Jeanne Testeur/ }).click();
  await expect(
    page.getByRole("heading", { name: "Jeanne Testeur" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel("Prénoms").fill("Luc");
  await page.getByLabel("Nom", { exact: true }).first().fill("Testeur");
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

  // Its lineage is set in the dashboard, link by link with the proofs…
  await page.goto("/fr/admin/lignees");
  await expect(
    page.getByRole("heading", {
      name: "D’Albert à Jacques (lignée d’exemple)",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Maillons de la lignée" })
      .locator(":scope > li"),
  ).toHaveCount(3);

  // …and the tree shows it step by step.
  await expect(async () => {
    await page.goto("/fr/arbre");
    await page
      .getByRole("button", { name: "Voir la démonstration" })
      .click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("Maillon 1 sur 3")).toBeVisible();
  await expect(
    page.getByText("Acte de baptême de Charles Exemple (source d’exemple)"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("Maillon 2 sur 3")).toBeVisible();

  // Every branch has its card and its way into the tree…
  await page.goto("/fr/armoiries");
  for (const name of [
    "Branche aînée (exemple)",
    "Rameau d’Hélène (exemple)",
    "Branche cadette (exemple)",
  ]) {
    const card = page.locator("article").filter({
      has: page.getByRole("heading", { name, exact: true }),
    });
    await expect(
      card.getByRole("link", { name: "Voir dans l’arbre" }),
    ).toHaveAttribute("href", /\/fr\/arbre\?depuis=/);
  }
  await expect(
    page.getByRole("heading", { name: "Les branches éteintes" }),
  ).toBeVisible();
  // …and two shields can be compared side by side.
  await page
    .getByRole("button", { name: "Comparer", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Comparer avec celui-ci" })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Deux écus côte à côte" }),
  ).toBeVisible();
  await expect(page.getByText("En rouge, ce qui les distingue.")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/fr/branches/exemple-cadette");
  await expect(
    page.getByRole("heading", { level: 1, name: "Branche cadette (exemple)" }),
  ).toBeVisible();
  await expect(page.getByText("Gaston Exemple")).toHaveCount(2);

  // Each person has a page of their own.
  await page.goto("/fr/arbre/albert-exemple-1850");
  await expect(
    page.getByRole("heading", { level: 1, name: "Albert Exemple" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Preuves/ }).click();
  await expect(
    page.getByText("Registre paroissial d’Exempleville (source d’exemple)"),
  ).toBeVisible();

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

test("an administrator adds a branch and its arms, shown on the arms page", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/fr/admin/armoiries");
  await page.getByRole("button", { name: "Ajouter une branche" }).click();
  await page.getByLabel("Nom de la branche").first().fill("Branche d’essai");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Branche d’essai")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter des armoiries" }).click();
  await page.getByLabel("Nom", { exact: true }).first().fill("Armes d’essai");
  await page
    .locator("label")
    .filter({ hasText: /^Croÿ$/ })
    .click();
  await expect(
    page.getByRole("radio", { name: "Croÿ", exact: true }),
  ).toBeChecked();
  await page
    .getByLabel("Branche", { exact: true })
    .selectOption({ label: "Branche d’essai" });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(async () => {
    await page.goto("/fr/armoiries");
    await expect(
      page.getByRole("heading", { name: "Branche d’essai", exact: true }),
    ).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Armes d’essai" }),
  ).toBeVisible();

  await page.goto("/fr/admin/armoiries");
  for (const name of ["Armes d’essai", "Branche d’essai"]) {
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("listitem")
      .filter({ hasText: name })
      .getByRole("button", { name: "Supprimer" })
      .click();
    await expect(
      page.getByRole("listitem").filter({ hasText: name }),
    ).toHaveCount(0);
  }
});

test("a story sent for validation, once published, appears on the sheet of each person it cites", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/fr/compte/histoires/nouvelle");
  await page.getByLabel("Titre").fill("Le jardin de Paul");
  await page
    .getByLabel("Texte")
    .fill("Une histoire écrite pour le test.\n\nDeuxième paragraphe.");
  await page.getByLabel("Époque : de").fill("1920");
  await page
    .locator("label")
    .filter({ hasText: /^Vie quotidienne$/ })
    .click();
  const people = page.getByRole("combobox", { name: "Personnes concernées" });
  await people.fill("Paul Test");
  await page.getByRole("option", { name: /Paul Testeur/ }).click();
  await expect(
    page.getByRole("button", { name: /Paul Testeur/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Envoyer pour validation" }).click();
  await page.waitForURL(/\/compte\/histoires$/);
  const mine = page
    .getByRole("listitem")
    .filter({ hasText: "Le jardin de Paul" });
  await expect(mine.getByText("À valider")).toBeVisible();

  await page.goto("/fr/admin/histoires");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Le jardin de Paul" })
    .getByRole("button", { name: "Publier" })
    .click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Le jardin de Paul" })
      .getByText("Publiée"),
  ).toBeVisible();

  await expect(async () => {
    await page.goto("/fr/arbre/paul-testeur-1900");
    await expect(
      page.getByRole("link", { name: /Le jardin de Paul/ }),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("link", { name: /Le jardin de Paul/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Le jardin de Paul" }),
  ).toBeVisible();
  await expect(
    page.locator(".story-body").getByText("Deuxième paragraphe."),
  ).toBeVisible();
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
