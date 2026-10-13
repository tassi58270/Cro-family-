import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PersonPage } from "@/components/arbre/person-page";
import { loadPerson, publicSlugs } from "@/lib/data/person";
import { VISITOR } from "@/lib/db";
import { getPathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { resolveLocale } from "@/lib/i18n/server";
import { isIndexable } from "@/lib/site";

/**
 * The page of a person, shareable (6.2). Built in advance for everyone the
 * public may see; anyone else (a living relative, for a member) is loaded in
 * the browser with the member's own rights, and never indexed.
 */
export async function generateStaticParams() {
  return (await publicSlugs()).map((personne) => ({ personne }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/arbre/[personne]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { personne } = await params;
  const person = await loadPerson(VISITOR, personne, locale);
  if (!person) {
    const t = await getTranslations({ locale, namespace: "tree.page" });
    return {
      title: t("privateTitle"),
      robots: { index: false, follow: false },
    };
  }
  const indexable =
    isIndexable() && person.status === "published" && !person.isDemo;
  return {
    title: person.name,
    alternates: {
      canonical: getPathname({
        locale,
        href: { pathname: "/arbre/[personne]", params: { personne } },
      }),
      languages: Object.fromEntries(
        routing.locales.map((l) => [
          l,
          getPathname({
            locale: l,
            href: { pathname: "/arbre/[personne]", params: { personne } },
          }),
        ]),
      ),
    },
    robots: { index: indexable, follow: indexable },
  };
}

export default async function Page({
  params,
}: PageProps<"/[locale]/arbre/[personne]">) {
  const locale = await resolveLocale(params);
  const { personne } = await params;
  const person = await loadPerson(VISITOR, personne, locale);
  return (
    <main id="contenu" className="page flex-1">
      <PersonPage slug={personne} locale={locale} initial={person} />
    </main>
  );
}
