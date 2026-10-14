import "server-only";
import { getTranslations } from "next-intl/server";
import { configuredAdmins, hashToken, newToken } from "@/lib/auth/tokens";
import { withSystem } from "@/lib/db";
import { sendEmail, simpleEmail } from "@/lib/email";
import { getPathname } from "@/lib/i18n/navigation";
import { routing, type Locale } from "@/lib/i18n/routing";
import { siteUrl } from "@/lib/site";

/**
 * The emails of contributions (6.7): to the administrators when something
 * arrives, to the member when it is received and when it is answered, and
 * the invitations. A failed email never loses what was sent: the proposal or
 * request is already saved.
 */

type Href = Parameters<typeof getPathname>[0]["href"];

const INVITATION_DAYS = 7;

export function absoluteUrl(locale: Locale, href: Href) {
  return new URL(getPathname({ locale, href }), siteUrl()).toString();
}

function localeOr(value: string | null | undefined): Locale {
  return routing.locales.find((l) => l === value) ?? routing.defaultLocale;
}

/** Every administrator, from ADMIN_EMAILS and the dashboard, in their language. */
export async function administrators(): Promise<
  { email: string; locale: Locale }[]
> {
  const rows = await withSystem((q) =>
    q<{ email: string; locale: string }>(
      `select a.email::text as email, p.preferred_locale as locale
       from private.accounts a join public.profiles p on p.id = a.id
       where p.role = 'admin' and p.disabled_at is null`,
    ),
  );
  const found = new Map(rows.map((r) => [r.email, localeOr(r.locale)]));
  for (const email of configuredAdmins())
    if (!found.has(email)) found.set(email, routing.defaultLocale);
  return [...found].map(([email, locale]) => ({ email, locale }));
}

type Message = {
  subject: string;
  lines: string[];
  action?: { label: string; url: string };
};

async function safely(send: () => Promise<void>) {
  try {
    await send();
  } catch (error) {
    console.error("[email]", error);
  }
}

/** One email to each administrator, written in their own language. */
export async function tellAdministrators(
  topic: string,
  write: (
    t: Awaited<ReturnType<typeof getTranslations<"emails">>>,
    locale: Locale,
  ) => Message,
) {
  for (const admin of await administrators()) {
    const t = await getTranslations({
      locale: admin.locale,
      namespace: "emails",
    });
    await safely(() =>
      sendEmail(
        simpleEmail({
          to: admin.email,
          topic,
          footer: t("footerAdmin"),
          ...write(t, admin.locale),
        }),
      ),
    );
  }
}

export async function tell(
  to: string,
  locale: Locale,
  topic: string,
  write: (t: Awaited<ReturnType<typeof getTranslations<"emails">>>) => Message,
) {
  const t = await getTranslations({ locale, namespace: "emails" });
  await safely(() =>
    sendEmail(simpleEmail({ to, topic, footer: t("footer"), ...write(t) })),
  );
}

/**
 * A sign-in link valid for a week, for someone invited or whose request was
 * approved. Returns the link, shown on screen only in local development.
 */
export async function sendWelcome(
  email: string,
  locale: Locale,
  kind: "invitation" | "approved",
  details: { name?: string | null; message?: string | null } = {},
): Promise<string> {
  const token = newToken();
  await withSystem((q) =>
    q(
      `insert into private.login_tokens (email, token_hash, purpose, expires_at)
       values ($1, $2, 'invitation', now() + make_interval(days => $3))`,
      [email, hashToken(token), INVITATION_DAYS],
    ),
  );
  const url = absoluteUrl(locale, {
    pathname: "/connexion/confirmer",
    query: { jeton: token },
  });
  await tell(email, locale, kind, (t) => ({
    subject: t(`${kind}.subject`),
    lines: [
      details.name ? t("hello", { name: details.name }) : t("helloNoName"),
      t(`${kind}.line1`),
      ...(details.message ? [details.message] : []),
      t(`${kind}.line2`, { days: INVITATION_DAYS }),
    ],
    action: { label: t(`${kind}.action`), url },
  }));
  return url;
}
