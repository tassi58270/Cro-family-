import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PhotoPage } from "@/components/photos/photo-page";
import { loadPhoto, publicPhotoIds } from "@/lib/data/photos";
import { VISITOR } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";
import { isIndexable } from "@/lib/site";

export async function generateStaticParams() {
  return (await publicPhotoIds()).map((photo) => ({ photo }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/photos/[photo]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { photo } = await params;
  const item = await loadPhoto(VISITOR, photo, locale);
  const t = await getTranslations({ locale, namespace: "photos" });
  if (!item)
    return {
      title: t("privateTitle"),
      robots: { index: false, follow: false },
    };
  const indexable = isIndexable() && !item.isDemo;
  return {
    title: item.caption?.text ?? t("title"),
    robots: { index: indexable, follow: indexable },
  };
}

/** One photo, large, with the people on it (6.5). */
export default async function Page({
  params,
}: PageProps<"/[locale]/photos/[photo]">) {
  const locale = await resolveLocale(params);
  const { photo } = await params;
  const item = await loadPhoto(VISITOR, photo, locale);
  return (
    <main id="contenu" className="page px-(--gutter) pt-8 pb-28 md:pt-12">
      <PhotoPage id={photo} locale={locale} initial={item} />
    </main>
  );
}
