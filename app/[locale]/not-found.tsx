import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { ErrorScreen } from "@/components/ui/error-screen";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import type { Locale } from "@/lib/i18n/routing";

/** Unknown address inside a language: the menu stays, two ways on. */
export default async function LocaleNotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "notFound" });
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col pt-(--header-h)">
        <ErrorScreen
          code="404"
          title={t("title")}
          body={t("body")}
          actions={
            <>
              <ButtonLink href="/">{t("backHome")}</ButtonLink>
              <ButtonLink href="/recherche" variant="secondary">
                {t("search")}
              </ButtonLink>
            </>
          }
        />
      </div>
      <SiteFooter locale={locale} />
    </>
  );
}
