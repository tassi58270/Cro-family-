import { getTranslations } from "next-intl/server";
import { Shield } from "@/components/heraldique/shield";
import { mainNav } from "@/lib/i18n/main-nav";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { BandsRule } from "./bands";
import { ButtonLink } from "./button";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";

/** Invitation to contribute, the site map, language, theme and credits. */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <footer className="page mt-auto bg-paper-2 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))] md:pt-24">
      <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-[1.3fr_1fr] md:gap-20">
        <section aria-labelledby="footer-invitation" className="grid gap-5">
          <BandsRule />
          <h2
            id="footer-invitation"
            className="max-w-[16ch] font-display text-title"
          >
            {t("invitationTitle")}
          </h2>
          <p className="max-w-prose text-ink-muted">{t("invitationBody")}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <ButtonLink href="/contribuer">{t("contribute")}</ButtonLink>
            <ButtonLink
              href={{ pathname: "/contribuer", hash: "acces" }}
              variant="secondary"
            >
              {t("requestAccess")}
            </ButtonLink>
          </div>
        </section>

        <div className="grid content-start gap-10">
          <nav aria-label={t("siteMap")}>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="link inline-flex min-h-11 items-center decoration-transparent hover:decoration-croy"
                  >
                    {nav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-4">
            <LanguageSwitcher className="-ml-3" />
            <ThemeSwitcher />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 border-t border-hairline-strong pt-6 text-caption text-ink-muted">
        <span className="inline-flex items-center gap-2.5 text-ink">
          <Shield arms="croy" decorative className="w-3.5" />
          <span className="font-display text-[1.125rem]">{t("house")}</span>
        </span>
        <span>{t("pronunciation")}</span>
        <span className="md:ml-auto">{t("credits")}</span>
      </div>
    </footer>
  );
}
