import type { Metadata } from "next";
import { getMessages, getTranslations } from "next-intl/server";
import { PrintButton } from "@/components/admin/print-button";
import { BandsRule } from "@/components/ui/bands";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

// Each part of the guide and the screen it leads to.
const SECTIONS = [
  ["start", "/admin/demonstration"],
  ["weekly", "/admin"],
  ["add", "/admin/arbre"],
  ["privacy", "/admin/personnes"],
  ["members", "/admin/membres"],
  ["undo", "/admin/journal"],
  ["languages", "/admin/traductions"],
  ["backup", "/admin/import"],
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/guide">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.guide" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The administrator's guide (step 12): two printed pages, each part leading
 * to its screen.
 */
export default async function GuidePage({
  params,
}: PageProps<"/[locale]/admin/guide">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.guide" });
  const { sections } = (await getMessages({ locale })).admin.guide;
  return (
    <article className="grid gap-10 print:gap-4 print:text-[10.5pt]">
      <header className="grid gap-4 print:gap-1">
        <BandsRule />
        <h1 className="font-display text-title-lg print:text-[22pt]">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-lead text-ink-muted print:text-[11pt]">
          {t("intro")}
        </p>
        <div>
          <PrintButton label={t("print")} />
        </div>
      </header>
      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2 print:grid-cols-2 print:gap-x-8 print:gap-y-4">
        {SECTIONS.map(([key, href]) => {
          const points = Object.values(sections[key].points);
          return (
            <section
              key={key}
              aria-labelledby={`guide-${key}`}
              className="grid break-inside-avoid content-start gap-3 border-t border-hairline pt-5 print:gap-1 print:pt-2"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id={`guide-${key}`}
                  className="font-display text-title-sm print:text-[13pt]"
                >
                  {t(`sections.${key}.title`)}
                </h2>
                <Link
                  href={href}
                  className="link inline-flex min-h-11 shrink-0 items-center text-caption font-medium print:hidden"
                >
                  {t("open")}
                  <span className="sr-only">
                    {" "}
                    · {t(`sections.${key}.title`)}
                  </span>
                </Link>
              </div>
              <ul className="grid gap-2 print:gap-0.5">
                {points.map((point) => (
                  <li key={point} className="flex gap-3 text-pretty">
                    <span
                      aria-hidden="true"
                      className="mt-[0.7em] h-px w-3 shrink-0 bg-croy [print-color-adjust:exact]"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}
