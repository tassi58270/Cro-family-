import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { Link } from "@/lib/i18n/navigation";
import { ButtonLink } from "./button";
import { EmptyState } from "./empty-state";

export type Section =
  | "tree"
  | "arms"
  | "stories"
  | "photos"
  | "places"
  | "search"
  | "contribute"
  | "signIn";

export async function sectionMetadata(
  locale: Locale,
  section: Section,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "sections" });
  return { title: t(`${section}.title`) };
}

/**
 * A section that the family has not filled yet, or that a later step of the
 * build will bring: the section name and an invitation, nothing invented.
 */
export async function SectionPlaceholder({
  locale,
  section,
  actionHref,
}: {
  locale: Locale;
  section: Section;
  actionHref?: ComponentProps<typeof Link>["href"];
}) {
  const t = await getTranslations({ locale, namespace: "sections" });
  const actionKey = `${section}.emptyAction` as Parameters<typeof t>[0];
  const action = actionHref && t.has(actionKey) ? t(actionKey) : null;

  return (
    <main id="contenu" className="page flex flex-1 flex-col">
      <p className="mx-auto mt-12 text-caption font-medium text-ink-muted md:mt-20">
        {t(`${section}.title`)}
      </p>
      <EmptyState
        headingLevel="h1"
        className="pt-6 md:pt-8"
        title={t(`${section}.emptyTitle`)}
        body={<p>{t(`${section}.emptyBody`)}</p>}
        action={
          action && actionHref ? (
            <ButtonLink href={actionHref}>{action}</ButtonLink>
          ) : undefined
        }
      />
    </main>
  );
}
