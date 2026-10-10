"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";

/** FR · EN · DE — switches language while staying on the same page. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  const params = useParams();

  return (
    <nav aria-label={t("languageSwitcher")} className={className}>
      <ul className="flex gap-1 text-sm font-medium">
        {routing.locales.map((locale) => (
          <li key={locale}>
            <Link
              // The params always match the current pathname, so the pair is valid.
              // @ts-expect-error -- next-intl cannot infer this pairing statically.
              href={{ pathname, params }}
              locale={locale}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === current ? "true" : undefined}
              title={t(`languages.${locale}`)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 uppercase transition-colors hover:text-croy aria-[current]:bg-ink aria-[current]:text-paper"
            >
              {locale}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
