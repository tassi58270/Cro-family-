import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ArmsGallery } from "@/components/armoiries/arms-gallery";
import { BlazonExplainer } from "@/components/armoiries/blazon-explainer";
import { BranchCard } from "@/components/armoiries/branch-card";
import { BranchRiver } from "@/components/armoiries/branch-river";
import { BandsRule } from "@/components/ui/bands";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadArmsPage } from "@/lib/data/arms";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/armoiries">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "armsPage" });
  return { title: t("title"), description: t("intro") };
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="grid gap-8 border-t border-hairline pt-12 md:gap-12 md:pt-16"
    >
      <div className="grid gap-4">
        <BandsRule />
        <h2 id={`${id}-titre`} className="font-display text-title">
          {title}
        </h2>
        {intro && <p className="max-w-2xl text-lead text-ink-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Arms and branches (cahier des charges, 6.3). The explanation of the first
 * arms is part of the site; everything else (arms, branches, their story)
 * comes from the family through the dashboard.
 */
export default async function ArmsPage({
  params,
}: PageProps<"/[locale]/armoiries">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "armsPage" });
  const { arms, branches } = await loadArmsPage(locale);
  // Arms of allied families sit with the family's, so that they can be compared.
  const family = [
    ...arms.filter((a) => a.kind === "family"),
    ...arms.filter((a) => a.kind === "alliance"),
  ];
  const communes = arms.filter((a) => a.kind === "commune");
  const extant = branches.filter((b) => !b.extinct);
  const extinct = branches.filter((b) => b.extinct);
  const card = (b: (typeof branches)[number]) => (
    <BranchCard
      key={b.id}
      branch={b}
      index={branches.indexOf(b)}
      arms={b.arms >= 0 ? arms[b.arms] : undefined}
    />
  );

  return (
    <main
      id="contenu"
      className="page grid gap-20 px-(--gutter) pt-10 pb-28 md:gap-28 md:pt-16"
    >
      <header className="grid max-w-4xl gap-5">
        <p className="text-caption font-medium text-croy-text">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
      </header>

      <BlazonExplainer />

      <Section
        id="galerie"
        title={t("gallery.title")}
        intro={family.length ? t("gallery.lead") : undefined}
      >
        {family.length ? (
          <ArmsGallery items={family} />
        ) : (
          <EmptyState
            className="py-8 md:py-10"
            headingLevel="h3"
            title={t("gallery.emptyTitle")}
            body={<p>{t("gallery.emptyBody")}</p>}
            action={<ButtonLink href="/contribuer">{t("suggest")}</ButtonLink>}
          />
        )}
      </Section>

      <Section
        id="branches"
        title={t("branches.title")}
        intro={branches.length ? t("branches.intro") : undefined}
      >
        {branches.length ? (
          <>
            <BranchRiver branches={branches} />
            {extant.length > 0 && (
              <div className="grid gap-x-12 gap-y-12 md:grid-cols-2">
                {extant.map(card)}
              </div>
            )}
          </>
        ) : (
          <EmptyState
            className="py-8 md:py-10"
            headingLevel="h3"
            title={t("branches.emptyTitle")}
            body={<p>{t("branches.emptyBody")}</p>}
            action={<ButtonLink href="/contribuer">{t("suggest")}</ButtonLink>}
          />
        )}
      </Section>

      {extinct.length > 0 && (
        <Section
          id="eteintes"
          title={t("extinct.title")}
          intro={t("extinct.intro")}
        >
          <div className="grid gap-x-12 gap-y-12 md:grid-cols-2">
            {extinct.map(card)}
          </div>
        </Section>
      )}

      {communes.length > 0 && (
        <Section
          id="communes"
          title={t("communes.title")}
          intro={t("communes.intro")}
        >
          <ArmsGallery items={communes} compact />
        </Section>
      )}
    </main>
  );
}
