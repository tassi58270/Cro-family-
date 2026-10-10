import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { overviewCounts, startupSteps } from "@/lib/data/admin";
import { cn } from "@/lib/design/cn";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminOverview({
  params,
}: PageProps<"/[locale]/admin">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.overview" });
  const { steps, counts } = await withViewer(viewerOf(session), async (q) => ({
    steps: await startupSteps(q),
    counts: await overviewCounts(q),
  }));
  const done = steps.filter((s) => s.done).length;
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="grid gap-12">
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
      </header>

      <section aria-labelledby="assistant" className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2 id="assistant" className="font-display text-title-sm">
              {t("assistant")}
            </h2>
            <p className="text-caption text-ink-muted">{t("assistantIntro")}</p>
          </div>
          <p className="tabular text-caption font-medium">
            {t("progress", { done, total: steps.length })}
          </p>
        </div>
        <div
          className="grid h-1.5 grid-cols-5 gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-label={t("assistant")}
        >
          {steps.map((step) => (
            <span
              key={step.key}
              className={step.done ? "bg-croy" : "bg-hairline"}
            />
          ))}
        </div>
        <ol className="grid gap-px border-y border-hairline bg-hairline">
          {steps.map((step, i) => (
            <li
              key={step.key}
              className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-3 bg-paper py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:items-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "tabular grid size-9 place-items-center rounded-full border font-display text-[1.125rem]",
                  step.done
                    ? "border-croy bg-croy text-on-croy"
                    : "border-hairline-strong",
                )}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <div className="grid gap-1">
                <h3 className="font-medium">
                  {t(`steps.${step.key}.title`)}
                  {step.done && (
                    <span className="ml-2 text-caption font-normal text-ink-muted">
                      {t("done")}
                    </span>
                  )}
                </h3>
                <p className="text-caption text-ink-muted">
                  {t(`steps.${step.key}.body`)}
                </p>
              </div>
              <div className="col-start-2 sm:col-start-3">
                {step.href ? (
                  <ButtonLink
                    href={step.href}
                    size="sm"
                    variant={step.done ? "secondary" : "primary"}
                  >
                    {t(`steps.${step.key}.action`)}
                  </ButtonLink>
                ) : (
                  <span className="text-caption text-ink-muted">
                    {t("soon")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="text-caption text-ink-muted">
          {t("gedcomHint")}{" "}
          <ButtonLink href="/admin/import" variant="ghost" size="sm">
            {t("gedcomAction")}
          </ButtonLink>
        </p>
      </section>

      <section aria-labelledby="chiffres" className="grid gap-6">
        <h2 id="chiffres" className="font-display text-title-sm">
          {t("figures")}
        </h2>
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {(
            [
              ["people", counts.people],
              ["living", counts.living],
              ["drafts", counts.drafts],
              ["suggestions", counts.suggestions],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="grid gap-1 border-t border-hairline pt-4">
              <dt className="text-caption text-ink-muted">
                {t(`counts.${key}`)}
              </dt>
              <dd className="tabular font-display text-title">
                {number.format(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
