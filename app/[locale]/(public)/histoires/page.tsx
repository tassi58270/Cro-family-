import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Magazine } from "@/components/histoires/magazine";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadStories } from "@/lib/data/stories";
import { VISITOR } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/histoires">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "stories" });
  return { title: t("title"), description: t("intro") };
}

/** Stories as a magazine (cahier des charges, 6.4), written by the family. */
export default async function StoriesPage({
  params,
}: PageProps<"/[locale]/histoires">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "stories" });
  const stories = await loadStories(VISITOR, locale);

  return (
    <main
      id="contenu"
      className="page grid gap-14 px-(--gutter) pt-10 pb-28 md:gap-20 md:pt-16"
    >
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid max-w-3xl gap-4">
          <p className="text-caption font-medium text-croy-text">
            {t("eyebrow")}
          </p>
          <h1 className="font-display text-title-lg">{t("title")}</h1>
          <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
        </div>
        <ButtonLink href="/compte/histoires/nouvelle" variant="secondary">
          {t("write")}
        </ButtonLink>
      </header>
      {stories.length ? (
        <Magazine stories={stories} locale={locale} />
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          body={<p>{t("emptyBody")}</p>}
          action={
            <ButtonLink href="/compte/histoires/nouvelle">
              {t("write")}
            </ButtonLink>
          }
        />
      )}
    </main>
  );
}
