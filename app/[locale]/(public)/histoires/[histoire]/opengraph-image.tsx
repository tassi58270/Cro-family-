import { getTranslations } from "next-intl/server";
import { loadStory } from "@/lib/data/stories";
import { VISITOR } from "@/lib/db";
import { shareImage, shareImageSize } from "@/lib/design/share-image";
import { resolveLocale } from "@/lib/i18n/server";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Croÿ";

/** A story's share image: its title. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; histoire: string }>;
}) {
  const locale = await resolveLocale(params);
  const { histoire } = await params;
  const story = await loadStory(VISITOR, histoire, locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  return shareImage({
    title: story?.title.text ?? "Croÿ",
    subtitle: t("stories"),
  });
}
