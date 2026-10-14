import { expect, test, type Browser } from "@playwright/test";
import pg from "pg";
import { expectAccessible, hasDatabase, signIn } from "./helpers";

/**
 * Step 10: family accounts and contributions. Done when a test member
 * proposes a correction and the administrator receives the email. Without
 * an email service, emails are recorded in private.emails, read here.
 */

async function emailsTo(recipient: string, topic: string) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ subject: string; body: string }>(
      `select subject, body from private.emails
       where recipient = $1 and topic = $2 order by created_at`,
      [recipient, topic],
    );
    return rows;
  } finally {
    await db.end();
  }
}

test("the contribute page explains and offers to ask for access", async ({
  page,
}) => {
  await page.goto("/fr/contribuer");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /se construit avec la famille/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Demander un accès famille" }),
  ).toBeVisible();
  await expectAccessible(page);
});

test.describe("with accounts", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({ isMobile }) => {
    test.skip(!hasDatabase, "needs DATABASE_URL");
    test.skip(isMobile, "writes to the shared database: desktop project only");
  });

  const member = `cousine-${Date.now()}@example.org`;

  async function memberPage(browser: Browser, link: string) {
    const context = await browser.newContext({
      viewport: { width: 380, height: 800 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(link);
    await page.getByRole("button", { name: "Me connecter" }).click();
    await page.waitForURL(/\/fr\/compte$/);
    return page;
  }

  test("a visitor asks for access and the administrators are told", async ({
    page,
  }) => {
    await page.goto("/fr/contribuer");
    await page.getByLabel("Votre nom").fill("Cousin Demandeur");
    await page.getByLabel("Votre adresse e-mail").fill("demandeur@example.org");
    await page
      .getByLabel("Votre lien avec la famille")
      .fill("Petit-fils d’une cousine d’exemple");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText("Demande envoyée")).toBeVisible();
    const mails = await emailsTo("admin@example.org", "access-request");
    expect(mails.at(-1)?.subject).toBe("Demande d’accès de Cousin Demandeur");
  });

  test("a member proposes a correction and the administrator receives the email", async ({
    page,
    browser,
  }) => {
    // The administrator invites a cousin.
    await signIn(page);
    await page.goto("/fr/admin/membres");
    await page.getByLabel("Nom", { exact: true }).fill("Cousine Test");
    await page.getByLabel("Adresse e-mail").fill(member);
    await page.getByRole("button", { name: "Envoyer l’invitation" }).click();
    const link = page.getByRole("link", { name: /connexion\/confirmer/ });
    await expect(link).toBeVisible();
    expect((await emailsTo(member, "invitation")).length).toBe(1);

    // She signs in from the invitation, on her phone, and proposes.
    const cousin = await memberPage(
      browser,
      (await link.getAttribute("href"))!,
    );
    await cousin.goto("/fr/contribuer");
    await cousin.getByText("Une correction", { exact: true }).click();
    await cousin.getByRole("button", { name: "Continuer" }).click();
    await expect(
      cousin.getByRole("heading", { name: "Sur qui ou sur quoi" }),
    ).toBeFocused();
    await cousin.getByRole("button", { name: "Continuer" }).click();
    await cousin
      .getByRole("button", { name: "Envoyer la proposition" })
      .click();
    await expect(cousin.getByText("À remplir pour continuer.")).toBeVisible();
    await cousin
      .getByLabel("Ce qui est à corriger")
      .fill("Une date d’exemple est fausse.");
    await cousin.getByLabel("Source").fill("Un acte d’exemple");
    await expectAccessible(cousin);
    await cousin
      .getByRole("button", { name: "Envoyer la proposition" })
      .click();
    await expect(cousin.getByText("Merci, c’est envoyé")).toBeVisible();

    // The administrator receives the email; the cousin, a confirmation.
    const alert = await emailsTo("admin@example.org", "suggestion");
    expect(alert.at(-1)?.subject).toBe("Nouvelle proposition de Cousine Test");
    expect(alert.at(-1)?.body).toContain("Une date d’exemple est fausse.");
    expect(alert.at(-1)?.body).toContain("/fr/admin/propositions/");
    expect(await emailsTo(member, "suggestion-received")).toHaveLength(1);

    // The administrator accepts, with a word; the cousin is told.
    await page.goto("/fr/admin/propositions");
    await page
      .getByRole("link", { name: /Correction/ })
      .first()
      .click();
    await expect(page.getByText("Un acte d’exemple")).toBeVisible();
    await page.getByLabel("Un mot pour l’auteur").fill("Merci, c’est corrigé.");
    await page.getByRole("button", { name: "Accepter" }).click();
    await expect(page.getByText(/^Acceptée le/)).toBeVisible();
    const decision = await emailsTo(member, "suggestion-accepted");
    expect(decision.at(-1)?.body).toContain("Merci, c’est corrigé.");

    await cousin.goto("/fr/compte");
    const proposals = cousin.getByRole("region", { name: "Mes propositions" });
    await expect(proposals.getByText("Acceptée")).toBeVisible();
    await expect(
      proposals.getByText(/Réponse.*Merci, c’est corrigé\./),
    ).toBeVisible();
    await expectAccessible(cousin);
  });

  test("sign-in links never stay readable in the email log", async () => {
    const login = await emailsTo("admin@example.org", "login");
    expect(login.length).toBeGreaterThan(0);
    for (const mail of login) expect(mail.body).not.toMatch(/jeton=[^…]/);
  });

  test("the members screen has no detectable accessibility issue", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/fr/admin/membres");
    await expect(page.getByText("Cousin Demandeur")).toBeVisible();
    await expectAccessible(page);
  });
});
