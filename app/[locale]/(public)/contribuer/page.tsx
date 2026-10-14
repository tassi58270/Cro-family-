import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContributeArea } from "@/components/contribuer/contribute-area";
import { BandsRule } from "@/components/ui/bands";
import { alternatesFor } from "@/lib/i18n/alternates";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contribuer">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "contribute" });
  return {
    title: t("eyebrow"),
    description: t("intro"),
    alternates: alternatesFor(locale, "/contribuer"),
  };
}

/** How to take part, and the forms to do it (cahier des charges, 6.7). */
export default async function ContributePage({
  params,
}: PageProps<"/[locale]/contribuer">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "contribute" });
  const steps = ["one", "two", "three"] as const;

  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-5xl gap-16 pt-10 pb-28 md:gap-20 md:pt-16"
    >
      <header className="grid max-w-3xl gap-5">
        <p className="text-caption font-medium text-croy-text">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("intro")}</p>
      </header>

      <section aria-labelledby="comment" className="grid gap-8">
        <div className="grid gap-4">
          <BandsRule />
          <h2 id="comment" className="font-display text-title-sm">
            {t("how.title")}
          </h2>
        </div>
        <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((step, i) => (
            <li key={step} className="grid content-start gap-2">
              <span
                aria-hidden="true"
                className="font-display text-title text-croy-text tabular-nums"
              >
                {i + 1}
              </span>
              <h3 className="font-medium">{t(`how.${step}`)}</h3>
              <p className="text-ink-muted">{t(`how.${step}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <ContributeArea />
    </main>
  );
}
