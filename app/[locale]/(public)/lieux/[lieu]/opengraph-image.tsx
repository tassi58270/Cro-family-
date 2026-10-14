import { getTranslations } from "next-intl/server";
import { loadPlace } from "@/lib/data/places";
import { VISITOR } from "@/lib/db";
import { shareImage, shareImageSize } from "@/lib/design/share-image";
import { resolveLocale } from "@/lib/i18n/server";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Croÿ";

/** A place's share image: its name. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; lieu: string }>;
}) {
  const locale = await resolveLocale(params);
  const { lieu } = await params;
  const place = await loadPlace(VISITOR, lieu, locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  return shareImage({
    title: place?.name.text ?? "Croÿ",
    subtitle: t("places"),
  });
}
