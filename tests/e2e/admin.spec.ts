import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { expectAccessible, hasDatabase, signIn } from "./helpers";

/**
 * Step 11: the administrator's dashboard. Done when someone who is not
 * technical adds an anecdote, links it to two people and publishes it,
 * without help: here, from the stories screen, on a phone-sized window.
 */

test.describe("dashboard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({ isMobile }) => {
    test.skip(!hasDatabase, "needs DATABASE_URL");
    test.skip(isMobile, "writes to the shared database: desktop project only");
  });

  const stamp = Date.now();
  const people = [
    { given: "Albertine", slug: `albertine-essai-${stamp}` },
    { given: "Barnabé", slug: `barnabe-essai-${stamp}` },
  ];
  const title = `Le pari du moulin ${stamp}`;

  test.beforeAll(async ({}, testInfo) => {
    if (!hasDatabase || testInfo.project.use.isMobile) return;
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      // A retry replays the whole group: start again from no test person.
      await db.query(
        `delete from public.stories where id in (select story_id from public.stories_i18n
         where title like 'Le pari du moulin %')`,
      );
      await db.query(
        "delete from public.people where slug ~ '^(albertine|barnabe)-essai-[0-9]+$'",
      );
      for (const p of people) {
        await db.query(
          `insert into public.people (slug, given_names, surname, deceased, status)
           values ($1, $2, 'Essai', true, 'published')`,
          [p.slug, p.given],
        );
      }
    } finally {
      await db.end();
    }
  });

  async function pick(page: Page, name: string) {
    const search = page.getByRole("combobox", { name: "Personnes concernées" });
    await search.fill(name);
    await page.getByRole("option", { name: new RegExp(name) }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(name) }),
    ).toBeVisible();
  }

  test("an anecdote linked to two people appears on both their sheets", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 380, height: 800 });
    await signIn(page);
    await page.goto("/fr/admin/histoires");
    await page.getByRole("button", { name: "Ajouter une anecdote" }).click();
    const panel = page.getByRole("dialog", { name: "Ajouter une anecdote" });
    await panel.getByLabel("Titre", { exact: true }).first().fill(title);
    await panel
      .getByLabel("L’anecdote", { exact: true })
      .first()
      .fill("Une anecdote inventée pour le test : un pari perdu au moulin.");
    await pick(page, "Albertine Essai");
    await pick(page, "Barnabé Essai");
    await expect(panel.getByLabel("Publiée")).toBeChecked();
    await expectAccessible(page);
    await panel.getByRole("button", { name: "Enregistrer" }).click();
    await expect(panel).toBeHidden();

    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row).toContainText("Albertine Essai, Barnabé Essai");

    for (const p of people) {
      await expect(async () => {
        await page.goto(`/fr/arbre/${p.slug}`);
        await expect(page.getByRole("link", { name: title })).toBeVisible({
          timeout: 2_000,
        });
      }).toPass({ timeout: 20_000 });
    }
    await page.getByRole("link", { name: title }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
  });

  test("the journal shows the anecdote and undoes it", async ({ page }) => {
    await signIn(page);
    await page.goto("/fr/admin/journal");
    const change = page
      .getByRole("listitem")
      .filter({ hasText: title })
      .filter({
        has: page.getByRole("button", { name: "Annuler cette modification" }),
      })
      .first();
    await expect(change).toContainText("Ajout · Histoire");
    await expectAccessible(page);
    page.once("dialog", (dialog) => dialog.accept());
    await change
      .getByRole("button", { name: "Annuler cette modification" })
      .click();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: title })
        .getByText("Annulée"),
    ).toBeVisible();

    await page.goto("/fr/admin/histoires");
    await expect(
      page.getByRole("listitem").filter({ hasText: title }),
    ).toHaveCount(0);
    await expect(async () => {
      await page.goto(`/fr/arbre/${people[0].slug}`);
      await expect(page.getByRole("link", { name: title })).toHaveCount(0, {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
  });

  for (const [path, heading] of [
    ["/fr/admin", "Bonjour"],
    ["/fr/admin/personnes", "Personnes"],
    ["/fr/admin/traductions", "Traductions"],
  ] as const) {
    test(`${path} has no detectable accessibility issue`, async ({ page }) => {
      await signIn(page);
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expectAccessible(page);
    });
  }
});
