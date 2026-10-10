import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import { BandsRule } from "@/components/ui/bands";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/connexion">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/connexion">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-xl flex-1 content-start gap-10 py-16 md:py-24"
    >
      <header className="grid gap-5">
        <BandsRule />
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("intro")}</p>
      </header>
      <SignInForm />
      <p className="border-t border-hairline pt-6 text-ink-muted">
        {t("noAccess")}{" "}
        <Link href="/contribuer" className="link text-ink">
          {t("requestAccess")}
        </Link>
      </p>
    </main>
  );
}
