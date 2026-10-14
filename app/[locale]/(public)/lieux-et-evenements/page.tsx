import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlacesApp } from "@/components/carte/places-app";
import { ButtonLink } from "@/components/ui/button";
import { loadPlacesIndex } from "@/lib/data/places";
import { VISITOR } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lieux-et-evenements">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "places" });
  return { title: t("title"), description: t("intro") };
}

/** The map and the timeline (cahier des charges, 6.6). */
export default async function PlacesPage({
  params,
}: PageProps<"/[locale]/lieux-et-evenements">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "places" });
  const index = await loadPlacesIndex(VISITOR, locale);
  return (
    <main id="contenu">
      <PlacesApp
        initial={index}
        locale={locale}
        emptyAction={
          <ButtonLink href="/contribuer" variant="secondary">
            {t("emptyAction")}
          </ButtonLink>
        }
      />
    </main>
  );
}
