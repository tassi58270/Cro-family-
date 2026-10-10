import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmForm } from "@/components/auth/confirm-form";
import { BandsRule } from "@/components/ui/bands";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/connexion/confirmer">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("confirmTitle"), robots: { index: false, follow: false } };
}

export default async function ConfirmPage({
  params,
  searchParams,
}: PageProps<"/[locale]/connexion/confirmer">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "auth" });
  const { jeton } = await searchParams;

  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-xl flex-1 content-start gap-10 py-16 md:py-24"
    >
      <header className="grid gap-5">
        <BandsRule />
        <h1 className="font-display text-title-lg">{t("confirmTitle")}</h1>
      </header>
      <ConfirmForm token={typeof jeton === "string" ? jeton : ""} />
    </main>
  );
}
