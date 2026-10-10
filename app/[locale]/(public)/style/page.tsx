import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Shield, type BuiltInArms } from "@/components/heraldique/shield";
import {
  BusyButtonDemo,
  FilterDemo,
  PanelDemo,
  ReplayTransition,
} from "@/components/style/demos";
import { BandsLoader, BandsRule, Tremas } from "@/components/ui/bands";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PersonChip,
  StatusChip,
  type ContentStatus,
} from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import { Term } from "@/components/ui/term";
import { contrast, passes } from "@/lib/design/contrast";
import { palette, type Swatch } from "@/lib/design/palette";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/style">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "style" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

const swatches: { key: Swatch; css: string }[] = [
  { key: "paper", css: "var(--paper)" },
  { key: "paper2", css: "var(--paper-2)" },
  { key: "ink", css: "var(--ink)" },
  { key: "inkMuted", css: "var(--ink-muted)" },
  { key: "hairline", css: "var(--hairline)" },
  { key: "croy", css: "var(--croy)" },
  { key: "croyDeep", css: "var(--croy-deep)" },
  { key: "croyText", css: "var(--croy-text)" },
];

const typeScale = [
  { className: "text-display", label: "display · 48–128 px" },
  { className: "text-title-lg", label: "title-lg · 36–72 px" },
  { className: "text-title", label: "title · 28–44 px" },
  { className: "text-title-sm", label: "title-sm · 22–28 px" },
] as const;

const durations = [
  { name: "press", ms: 140 },
  { name: "fast", ms: 200 },
  { name: "base", ms: 320 },
  { name: "slow", ms: 600 },
];

const armsList: { arms?: BuiltInArms; label: string }[] = [
  { arms: "croy", label: "croy" },
  { arms: "croy-renty", label: "croyRenty" },
  { arms: "hongrie-ancienne", label: "hongrieAncienne" },
  { label: "blank" },
];

const statuses: ContentStatus[] = ["draft", "pending", "published", "rejected"];

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="grid gap-8 border-t border-hairline py-14 md:grid-cols-[16rem_1fr] md:gap-16 md:py-20"
    >
      <header className="grid content-start gap-3">
        <h2 id={`${id}-titre`} className="font-display text-title-sm">
          {title}
        </h2>
        {intro && <p className="text-caption text-ink-muted">{intro}</p>}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function StylePage({
  params,
}: PageProps<"/[locale]/style">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "style" });
  const tArms = await getTranslations({ locale, namespace: "arms" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const tGlossary = await getTranslations({ locale, namespace: "glossary" });
  const tSections = await getTranslations({ locale, namespace: "sections" });
  const ratio = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const verdict = (value: number) =>
    passes(value, "small")
      ? t("contrastSmall")
      : passes(value, "large")
        ? t("contrastLarge")
        : t("contrastFail");

  const term = (key: "fasce" | "gueules" | "argent" | "ecartele" | "doloire") =>
    function GlossaryTerm(chunks: ReactNode) {
      return <Term definition={tGlossary(key)}>{chunks}</Term>;
    };

  return (
    <main id="contenu" className="page mx-auto w-full max-w-7xl pb-24">
      <header className="grid gap-6 pt-14 pb-16 md:pt-24 md:pb-24">
        <BandsRule />
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
        <p className="text-caption text-ink-muted">{t("internal")}</p>
      </header>

      <Section id="couleurs" title={t("colors")} intro={t("colorsIntro")}>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {swatches.map(({ key, css }) => {
            const light = contrast(palette.light[key], palette.light.paper);
            const dark = contrast(palette.dark[key], palette.dark.paper);
            return (
              <li key={key} className="grid gap-3">
                <span
                  className="block aspect-[4/3] border border-hairline"
                  style={{ background: css }}
                />
                <span className="grid gap-1 text-caption">
                  <span className="font-medium text-ink">
                    {t(`swatches.${key}`)}
                  </span>
                  <span className="tabular text-ink-muted">
                    ☀ {palette.light[key].toUpperCase()} · {ratio.format(light)}
                    :1 · {verdict(light)}
                  </span>
                  <span className="tabular text-ink-muted">
                    ☾ {palette.dark[key].toUpperCase()} · {ratio.format(dark)}:1
                    · {verdict(dark)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="typographie" title={t("type")} intro={t("typeIntro")}>
        <div className="grid gap-10">
          <p
            lang="fr"
            className="font-display text-monument font-medium tracking-[-0.015em]"
          >
            Croÿ
          </p>
          {typeScale.map(({ className, label }) => (
            <div key={className} className="grid gap-2">
              <span className="tabular text-caption text-ink-muted">
                {label}
              </span>
              <p className={`font-display ${className}`}>{t("typeSample")}</p>
            </div>
          ))}
          <div className="grid max-w-prose gap-2">
            <span className="tabular text-caption text-ink-muted">
              lead · 18–22 px
            </span>
            <p className="text-lead">{t("typeBody")}</p>
          </div>
          <div className="grid max-w-prose gap-2">
            <span className="tabular text-caption text-ink-muted">
              body · 16 / 18 px — caption · 14 px
            </span>
            <p>{t("typeBody")}</p>
            <p className="text-caption text-ink-muted">{t("typeBody")}</p>
          </div>
          <div className="grid gap-2">
            <span className="text-caption text-ink-muted">{t("numbers")}</span>
            <p className="tabular font-display text-title-lg">0123456789</p>
            <p className="tabular">1111 · 2026 · 0 · 88</p>
          </div>
        </div>
      </Section>

      <Section id="espacements" title={t("spacing")} intro={t("spacingIntro")}>
        <div className="grid gap-10">
          <div className="flex flex-wrap items-end gap-6">
            {[4, 8, 16, 24, 40, 64, 96].map((px) => (
              <div key={px} className="grid justify-items-start gap-2">
                <span
                  className="block bg-croy"
                  style={{ width: px, height: px }}
                />
                <span className="tabular text-caption text-ink-muted">
                  {px}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            {[
              ["0", "rounded-none"],
              ["xs · 2", "rounded-xs"],
              ["sm · 4", "rounded-sm"],
              ["full", "rounded-full"],
            ].map(([label, className]) => (
              <div key={label} className="grid justify-items-start gap-2">
                <span
                  className={`block size-16 border-2 border-ink ${className}`}
                />
                <span className="tabular text-caption text-ink-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <ul className="grid max-w-xl gap-3">
            {durations.map(({ name, ms }) => (
              <li
                key={name}
                className="grid grid-cols-[5rem_1fr] items-center gap-4"
              >
                <span className="tabular text-caption text-ink-muted">
                  {name} · {ms}
                </span>
                <span
                  className="block h-1.5 bg-ink"
                  style={{ width: `${(ms / 600) * 100}%` }}
                />
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="motif" title={t("motif")} intro={t("motifIntro")}>
        <div className="grid gap-10">
          <ul className="grid gap-5">
            <li className="flex items-center gap-4">
              <Tremas />
              <span className="flex-1">{t("motifList.separator")}</span>
              <BandsRule />
            </li>
            <li className="flex items-center gap-4">
              <Tremas />
              <span className="flex-1">{t("motifList.loader")}</span>
              <BandsLoader
                className="text-croy"
                label={t("motifList.loader")}
              />
            </li>
            <li className="flex items-center gap-4">
              <Tremas />
              <span className="flex-1">{t("motifList.hover")}</span>
            </li>
          </ul>
          <div>
            <ReplayTransition />
          </div>
        </div>
      </Section>

      <Section id="boutons" title={t("buttons")}>
        <div className="grid gap-8">
          <div className="flex flex-wrap items-center gap-4">
            <Button>{t("buttonPrimary")}</Button>
            <Button variant="secondary">{t("buttonSecondary")}</Button>
            <Button variant="ghost">{t("buttonGhost")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">{t("buttonPrimary")}</Button>
            <Button size="sm" variant="secondary">
              {t("buttonSecondary")}
            </Button>
            <BusyButtonDemo />
            <Button disabled>{t("buttonDisabled")}</Button>
            <ButtonLink href="/histoires" variant="secondary">
              {t("buttonGhost")} →
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section id="cartes" title={t("cards")}>
        <div className="grid gap-14">
          <Card
            size="feature"
            href="/histoires"
            eyebrow={t("cardEyebrow")}
            title={t("cardFeatureTitle")}
            excerpt={t("cardExcerpt")}
            media={
              <div className="grid h-full min-h-56 place-items-center">
                <Shield arms="croy" decorative className="w-28 md:w-36" />
              </div>
            }
            footer={
              <>
                <PersonChip name={t("chipPerson")} href="/arbre" />
                <PersonChip name={t("chipPerson2")} href="/arbre" />
              </>
            }
          />
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              href="/histoires"
              eyebrow={t("cardEyebrow")}
              title={t("cardTitle")}
              excerpt={t("cardExcerpt")}
              media={
                <div className="grid h-full place-items-center">
                  <Shield arms="croy-renty" decorative className="w-20" />
                </div>
              }
              footer={<PersonChip name={t("chipPerson")} href="/arbre" />}
            />
            <Card
              href="/histoires"
              eyebrow={t("cardEyebrow")}
              title={t("cardTitle")}
              excerpt={t("cardExcerpt")}
            />
          </div>
        </div>
      </Section>

      <Section id="pastilles" title={t("chips")}>
        <div className="grid gap-8">
          <div className="flex flex-wrap gap-2">
            <PersonChip name={t("chipPerson")} href="/arbre" />
            <PersonChip name={t("chipPerson2")} href="/arbre" />
          </div>
          <FilterDemo
            labels={(["war", "court", "travel", "daily"] as const).map((k) =>
              t(`filters.${k}`),
            )}
          />
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <StatusChip key={status} status={status}>
                {tStatus(status)}
              </StatusChip>
            ))}
          </div>
        </div>
      </Section>

      <Section id="champs" title={t("fields")}>
        <form className="grid max-w-xl gap-7" action="#">
          <TextField
            label={t("fieldName")}
            hint={t("fieldNameHint")}
            name="name"
            autoComplete="off"
            defaultValue={t("chipPerson")}
          />
          <div className="grid gap-7 sm:grid-cols-2">
            <TextField
              label={t("fieldDate")}
              error={t("fieldDateError")}
              name="date"
              inputMode="numeric"
              defaultValue="18.."
            />
            <SelectField
              label={t("fieldPrecision")}
              name="precision"
              defaultValue="1"
            >
              {(["exact", "about", "before", "after"] as const).map((k, i) => (
                <option key={k} value={i}>
                  {t(`precisions.${k}`)}
                </option>
              ))}
            </SelectField>
          </div>
          <TextArea
            label={t("fieldStory")}
            optionalLabel={t("fieldOptional")}
            name="story"
          />
          <Checkbox
            label={t("fieldAnonymous")}
            hint={t("fieldAnonymousHint")}
            name="anonymous"
          />
        </form>
      </Section>

      <Section id="panneau" title={t("panel")} intro={t("panelIntro")}>
        <PanelDemo />
      </Section>

      <Section id="armoiries" title={t("arms")} intro={t("armsIntro")}>
        <div className="grid gap-10">
          <ul className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {armsList.map(({ arms, label }) => (
              <li key={label} className="grid justify-items-start gap-4">
                <Shield
                  arms={arms}
                  label={tArms(label as "croy")}
                  className="w-full max-w-36"
                />
                <span className="flex items-end gap-3">
                  <Shield arms={arms} decorative className="w-10" />
                  <Shield arms={arms} decorative className="w-6" />
                  <Shield arms={arms} decorative className="w-4" />
                </span>
                <span className="text-caption text-ink-muted">
                  {arms ? tArms(label as "croy") : t("armsBlank")}
                </span>
              </li>
            ))}
          </ul>
          <p className="max-w-prose">
            {t.rich("glossary", {
              fasce: term("fasce"),
              gueules: term("gueules"),
              argent: term("argent"),
              ecartele: term("ecartele"),
              doloire: term("doloire"),
            })}
          </p>
        </div>
      </Section>

      <Section id="etat-vide" title={t("empty")} intro={t("emptyIntro")}>
        <div className="border border-hairline">
          <EmptyState
            headingLevel="h3"
            title={tSections("stories.emptyTitle")}
            body={<p>{tSections("stories.emptyBody")}</p>}
            action={
              <ButtonLink href="/contribuer">
                {tSections("stories.emptyAction")}
              </ButtonLink>
            }
          />
        </div>
      </Section>

      <Section id="menu" title={t("menuFooter")}>
        <p className="max-w-prose text-ink-muted">{t("menuFooterIntro")}</p>
      </Section>
    </main>
  );
}
