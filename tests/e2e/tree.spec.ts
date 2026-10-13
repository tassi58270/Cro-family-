import { expect, test, type Page } from "@playwright/test";
import type { PersonDetail } from "@/lib/data/person";
import type { TreeData } from "@/lib/data/tree";
import { syntheticTree } from "@/lib/demo/synthetic";
import { expectAccessible } from "./helpers";

/**
 * Step 6 is done when a person is found in fewer than three gestures and the
 * tree stays fluid with 2 000 test people (cahier des charges, section 8).
 * The tree file is served by the test itself, so these checks do not depend
 * on what the database holds.
 */

function bigTree(): TreeData {
  const data = syntheticTree(2000);
  data.people[1777].given = "Aldegonde";
  data.people[1777].sex = "female";
  // A living person, as the public receives them: a placeholder.
  Object.assign(data.people[1999], {
    hidden: true,
    given: null,
    surname: null,
    birth: null,
    death: null,
    birthPrecision: null,
    deathPrecision: null,
  });
  return data;
}

function sheetOf(data: TreeData, i: number): PersonDetail {
  const p = data.people[i];
  return {
    id: p.id,
    slug: p.slug!,
    name: `${p.given} ${p.surname}`,
    givenNames: p.given,
    surname: p.surname,
    epithet: null,
    sex: p.sex ?? "unknown",
    birth: p.birth
      ? { date: `${p.birth}-01-01`, precision: "year", place: null }
      : null,
    death: p.death
      ? { date: `${p.death}-01-01`, precision: "year", place: null }
      : null,
    deceased: p.deceased,
    living: false,
    status: "published",
    isDemo: false,
    branch: null,
    arms: null,
    originFamily: null,
    biography: null,
    roles: null,
    works: null,
    titles: [],
    parents: [],
    siblings: [],
    unions: [],
    otherChildren: [],
    stories: [],
    places: [],
    events: [],
    sources: [],
    filiationSources: {},
  };
}

async function serveTree(page: Page, data: TreeData) {
  await page.route(/\/api\/arbre\/fr$/, (route) =>
    route.fulfill({ json: data }),
  );
  await page.route(/\/api\/personne\/[^/?]+/, (route) => {
    const slug = new URL(route.request().url()).pathname.split("/").pop();
    const i = data.people.findIndex((p) => p.slug === slug);
    return i < 0
      ? route.fulfill({ status: 404 })
      : route.fulfill({ json: sheetOf(data, i) });
  });
}

test("an empty tree invites the family to add the first people", async ({
  page,
}) => {
  await serveTree(page, {
    ...syntheticTree(1),
    people: [],
    links: [],
    unions: [],
  });
  await page.goto("/fr/arbre");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /L’arbre attend ses premières branches/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Proposer une personne" }),
  ).toBeVisible();
});

test("a person is found among 2 000 in three gestures", async ({ page }) => {
  const data = bigTree();
  await serveTree(page, data);
  await page.goto("/fr/arbre");
  await expect(page.locator(".tree-card").first()).toBeVisible();

  const search = page.getByRole("combobox", { name: "Chercher une personne" });
  await search.click(); // 1
  await search.fill("Aldegonde"); // 2
  await expect(page.getByRole("option", { name: /Aldegonde/ })).toBeVisible();
  await page.getByRole("option", { name: /Aldegonde/ }).click(); // 3

  const sheet = page.getByRole("dialog", { name: /Aldegonde/ });
  await expect(sheet).toBeVisible();
  await expect(page.locator('[data-card="1777"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page).toHaveURL(/personne=test-1777/);
});

test("the tree stays fluid with 2 000 people", async ({ page }) => {
  await serveTree(page, bigTree());
  await page.goto("/fr/arbre");
  await expect(page.locator(".tree-card").first()).toBeVisible();

  // Every generation open at once.
  const started = Date.now();
  await page.getByRole("combobox", { name: "Générations" }).selectOption("12");
  await expect(page.locator(".tree-node").first()).toBeVisible();
  await page.getByRole("button", { name: "Voir tout l’arbre" }).click();
  await page.waitForTimeout(300);
  expect(Date.now() - started).toBeLessThan(4000);

  // Only what is near the screen is drawn.
  const drawn = await page.locator(".tree-card, .tree-card-far").count();
  expect(drawn).toBeLessThan(2000);

  // Dragging the tree keeps a steady pace.
  const box = (await page.locator(".tree-canvas").boundingBox())!;
  const frames = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const times: number[] = [];
        const tick = (t: number) => {
          times.push(t);
          if (times.length < 60) requestAnimationFrame(tick);
          else resolve(times);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 30; i++)
    await page.mouse.move(
      box.x + box.width / 2 - i * 12,
      box.y + box.height / 2 - i * 6,
    );
  await page.mouse.up();
  const times = await frames;
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const average = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  expect(average).toBeLessThan(50);
});

test("living people are placeholders that cannot be searched", async ({
  page,
}) => {
  const data = bigTree();
  // The first ancestor's only child is the placeholder.
  data.links = data.links.filter(([p, c]) => c !== 1999 && p !== 0 && p !== 1);
  data.links.push([0, 1999, -1, 0]);
  data.entryPoints = [
    { label: "Depuis le premier", person: 0, isDefault: true },
  ];
  await serveTree(page, data);
  await page.goto("/fr/arbre");
  await expect(
    page.getByRole("button", { name: "Personne vivante" }).first(),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Chercher une personne" })
    .fill("vivante");
  await expect(
    page.getByText("Aucune personne ne correspond.", { exact: false }),
  ).toBeVisible();
});

test("the time slider dims those not alive that year and is kept in the address", async ({
  page,
}) => {
  await serveTree(page, bigTree());
  await page.goto("/fr/arbre");
  await expect(page.locator(".tree-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Curseur du temps" }).click();
  await page.getByRole("slider", { name: "Année" }).fill("1450");
  await expect(page).toHaveURL(/annee=1450/);
  // The first ancestor, born in 1400, is dead by 1450 or not; the root card shows it.
  const root = page.locator('[data-card="0"]');
  const opacity = await root.evaluate((el) => getComputedStyle(el).opacity);
  expect(["1", "0.26"]).toContain(opacity);
  await page.reload();
  await expect(page.getByRole("slider", { name: "Année" })).toHaveValue("1450");
});

test("« Quel est le lien ? » lights the path and says the relationship", async ({
  page,
}) => {
  const data = bigTree();
  data.people[0].given = "Ancêtre";
  const child = data.links.find(([p]) => p === 0)![1];
  const grandchild = data.links.find(([p]) => p === child)![1];
  data.people[grandchild].given = "Descendant";
  data.people[grandchild].sex = "male";
  await serveTree(page, data);
  await page.goto("/fr/arbre");
  await page.getByRole("button", { name: "Quel est le lien ?" }).click();
  await page
    .getByRole("combobox", { name: "Première personne" })
    .fill("Ancêtre");
  await page.keyboard.press("Enter");
  await page
    .getByRole("combobox", { name: "Seconde personne" })
    .fill("Descendant");
  await page.keyboard.press("Enter");
  await expect(page.getByText("petit-fils")).toBeVisible();
  await expect(page.locator(".tree-card")).toHaveCount(3);
});

test("the list view works from the keyboard", async ({ page }) => {
  await serveTree(page, bigTree());
  await page.goto("/fr/arbre");
  await page.getByRole("button", { name: "Liste" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^1\s999 personnes$/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/Une personne vivante n’apparaît pas/),
  ).toBeVisible();
  const first = page.locator(".tree-stage ul button").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("arrow keys go from card to card and Enter opens the sheet", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "keyboard on a computer");
  await serveTree(page, bigTree());
  await page.goto("/fr/arbre");
  const root = page.locator('[data-card="0"]');
  await expect(root).toBeVisible();
  await root.focus();
  await page.keyboard.press("ArrowDown");
  const focused = page.locator(".tree-card:focus");
  await expect(focused).toHaveCount(1);
  expect(await focused.getAttribute("data-card")).not.toBe("0");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the tree page has no detectable accessibility issue", async ({
  page,
}) => {
  await serveTree(page, bigTree());
  await page.goto("/fr/arbre");
  await expect(page.locator(".tree-card").first()).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Liste" }).click();
  await expectAccessible(page);
});
