import { getTranslations } from "next-intl/server";
import { loadPerson } from "@/lib/data/person";
import { VISITOR } from "@/lib/db";
import { shareImage, shareImageSize } from "@/lib/design/share-image";
import { yearOf } from "@/lib/genealogie/dates";
import { resolveLocale } from "@/lib/i18n/server";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Croÿ";

/** A person's share image; a living person's page shares the site's image. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; personne: string }>;
}) {
  const locale = await resolveLocale(params);
  const { personne } = await params;
  const person = await loadPerson(VISITOR, personne, locale);
  const t = await getTranslations({ locale, namespace: "home" });
  if (!person) return shareImage({ title: "Croÿ", subtitle: t("tagline") });
  const born = yearOf(person.birth);
  const died = yearOf(person.death);
  const years = died ? `${born ?? "?"} – ${died}` : born ? String(born) : "";
  return shareImage({
    title: person.name,
    subtitle: [years, person.branch?.name].filter(Boolean).join(" · "),
  });
}
