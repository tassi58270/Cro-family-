import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PhotosApp } from "@/components/photos/photos-app";
import { ButtonLink } from "@/components/ui/button";
import { loadPhotoIndex } from "@/lib/data/photos";
import { VISITOR } from "@/lib/db";
import { alternatesFor } from "@/lib/i18n/alternates";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/photos">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "photos" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: alternatesFor(locale, "/photos"),
  };
}

/** The page that gives faces to the tree (cahier des charges, 6.5). */
export default async function PhotosPage({
  params,
}: PageProps<"/[locale]/photos">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "photos" });
  const index = await loadPhotoIndex(VISITOR, locale);
  return (
    <main id="contenu" className="grid gap-10 pt-10 pb-28 md:gap-14 md:pt-16">
      <header className="grid max-w-4xl gap-4 px-(--gutter)">
        <p className="text-caption font-medium text-croy-text">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
      </header>
      <PhotosApp
        initial={index}
        locale={locale}
        action={
          <ButtonLink href="/compte/photos" variant="secondary">
            {t("send")}
          </ButtonLink>
        }
      />
    </main>
  );
}
