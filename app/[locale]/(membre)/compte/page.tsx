import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BandsRule } from "@/components/ui/bands";
import { Button, ButtonLink } from "@/components/ui/button";
import { signOut } from "@/app/[locale]/(public)/connexion/actions";
import { requireMember } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** First version of the member area; completed at step 10. */
export default async function AccountPage({
  params,
}: PageProps<"/[locale]/compte">) {
  const locale = await resolveLocale(params);
  const session = await requireMember(locale);
  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-3xl flex-1 content-start gap-10 py-16 md:py-24"
    >
      <header className="grid gap-5">
        <BandsRule />
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">
          {t("signedInAs", { email: session.email })}
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/compte/histoires" variant="secondary">
          {t("myStories")}
        </ButtonLink>
        {session.role === "admin" && (
          <ButtonLink href="/admin">{t("dashboard")}</ButtonLink>
        )}
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="secondary">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </main>
  );
}
