import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { resolveLocale } from "@/lib/i18n/server";

/** Temporary home page (step 1). The real one is built at step 5. */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <main
      id="contenu"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24 md:px-10"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 30"
        className="w-12 fill-croy"
        focusable="false"
      >
        <rect y="0" width="48" height="6" />
        <rect y="12" width="48" height="6" />
        <rect y="24" width="48" height="6" />
      </svg>
      <p className="mt-10 text-base font-medium text-ink-muted">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-6xl">
        {t("title")}
      </h1>
      <p className="mt-8 text-lg md:text-xl">{t("status")}</p>
      <p className="mt-3 max-w-prose text-base text-pretty text-ink-muted md:text-lg">
        {t("body")}
      </p>
      <LanguageSwitcher className="mt-12 -ml-3" />
    </main>
  );
}
