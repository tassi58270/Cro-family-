import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SearchApp } from "@/components/recherche/search-app";
import { alternatesFor } from "@/lib/i18n/alternates";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/recherche">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "searchPage" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: alternatesFor(locale, "/recherche"),
  };
}

/** The global search (section 5): static; the index loads in the browser. */
export default async function SearchPage({
  params,
}: PageProps<"/[locale]/recherche">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "searchPage" });
  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-3xl content-start gap-10 pt-10 pb-28 md:pt-16"
    >
      <header className="grid gap-4">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
      </header>
      <SearchApp locale={locale} />
    </main>
  );
}
