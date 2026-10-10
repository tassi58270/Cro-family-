import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { resolveLocale } from "@/lib/i18n/server";
import { isIndexable, siteUrl } from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  const indexable = isIndexable();

  return {
    metadataBase: siteUrl(),
    title: { default: t("siteName"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    alternates: {
      canonical: getPathname({ locale, href: "/" }),
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, getPathname({ locale: l, href: "/" })]),
      ),
    },
    openGraph: { siteName: t("siteName"), locale, type: "website" },
    robots: { index: indexable, follow: indexable },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:text-ink focus:outline-2 focus:outline-croy"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
