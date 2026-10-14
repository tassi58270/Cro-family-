import { getTranslations } from "next-intl/server";
import { loadBranchPage } from "@/lib/data/arms";
import { shareImage, shareImageSize } from "@/lib/design/share-image";
import { resolveLocale } from "@/lib/i18n/server";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Croÿ";

/** A branch's share image: its name. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; branche: string }>;
}) {
  const locale = await resolveLocale(params);
  const { branche } = await params;
  const data = await loadBranchPage(branche, locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  return shareImage({
    title: data?.branch.name ?? "Croÿ",
    subtitle: t("arms"),
  });
}
