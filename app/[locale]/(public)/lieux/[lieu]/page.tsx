import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Locator } from "@/components/carte/locator";
import { PlacePage } from "@/components/carte/place-page";
import { project } from "@/lib/carte/project";
import { loadPlace, publicPlaceSlugs } from "@/lib/data/places";
import { VISITOR } from "@/lib/db";
import { alternatesFor } from "@/lib/i18n/alternates";
import { resolveLocale } from "@/lib/i18n/server";
import { isIndexable } from "@/lib/site";

/** A place (6.6), built in advance and regenerated after each publication. */
export async function generateStaticParams() {
  return (await publicPlaceSlugs()).map((lieu) => ({ lieu }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lieux/[lieu]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { lieu } = await params;
  const place = await loadPlace(VISITOR, lieu, locale);
  if (!place) {
    const t = await getTranslations({ locale, namespace: "places" });
    return { title: t("place.privateTitle") };
  }
  const indexable = isIndexable() && !place.isDemo;
  return {
    title: place.name.text,
    alternates: alternatesFor(locale, {
      pathname: "/lieux/[lieu]",
      params: { lieu },
    }),
    description: place.summary?.text,
    robots: { index: indexable, follow: indexable },
  };
}

export default async function Page({
  params,
}: PageProps<"/[locale]/lieux/[lieu]">) {
  const locale = await resolveLocale(params);
  const { lieu } = await params;
  const place = await loadPlace(VISITOR, lieu, locale);
  if (!place) notFound();
  const t = await getTranslations({ locale, namespace: "places" });
  const point =
    place.lat !== null && place.lng !== null
      ? project([place.lng, place.lat])
      : null;
  return (
    <main id="contenu" className="page px-(--gutter) pt-10 pb-28 md:pt-16">
      <PlacePage
        initial={place}
        locale={locale}
        locator={
          point && (
            <Locator
              x={point[0]}
              y={point[1]}
              label={t("place.locator", { name: place.name.text })}
            />
          )
        }
      />
    </main>
  );
}
