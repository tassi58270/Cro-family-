import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TreeApp } from "@/components/arbre/tree-app";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/arbre">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "sections" });
  return { title: t("tree.title") };
}

/**
 * The family tree. The page itself is static; the tree arrives as one
 * compact file (visitors: /api/arbre/{locale}, without the living; members:
 * the full one), so that it is drawn at once and cached.
 */
export default async function Page({ params }: PageProps<"/[locale]/arbre">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "sections" });

  return (
    <main id="contenu" className="flex flex-1 flex-col">
      <TreeApp
        locale={locale}
        empty={
          <div className="page flex flex-1 flex-col">
            <p className="mx-auto mt-12 text-caption font-medium text-ink-muted md:mt-20">
              {t("tree.title")}
            </p>
            <EmptyState
              headingLevel="h1"
              className="pt-6 md:pt-8"
              title={t("tree.emptyTitle")}
              body={<p>{t("tree.emptyBody")}</p>}
              action={
                <ButtonLink href="/contribuer">
                  {t("tree.emptyAction")}
                </ButtonLink>
              }
            />
          </div>
        }
      />
    </main>
  );
}
