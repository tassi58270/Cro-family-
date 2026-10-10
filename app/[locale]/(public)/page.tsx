import { getTranslations } from "next-intl/server";
import { BandsRule } from "@/components/ui/bands";
import { resolveLocale } from "@/lib/i18n/server";

/** Temporary home page (step 1). The real one is built at step 5. */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <main
      id="contenu"
      className="page mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-24"
    >
      <BandsRule />
      <p className="mt-10 font-medium text-ink-muted">{t("eyebrow")}</p>
      <h1 className="mt-3 font-display text-title-lg">{t("title")}</h1>
      <p className="mt-8 text-lead">{t("status")}</p>
      <p className="mt-3 max-w-prose text-ink-muted">{t("body")}</p>
    </main>
  );
}
