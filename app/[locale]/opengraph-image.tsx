import { getTranslations } from "next-intl/server";
import { loadHome } from "@/lib/data/home";
import { shareImage, shareImageSize } from "@/lib/design/share-image";
import { resolveLocale } from "@/lib/i18n/server";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Croÿ";

/** The site's share image, in each language, with the family's tagline. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "home" });
  const home = await loadHome(locale);
  return shareImage({
    title: "Croÿ",
    subtitle: home.tagline?.text ?? t("tagline"),
  });
}
