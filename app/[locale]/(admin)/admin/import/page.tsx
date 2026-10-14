import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GedcomImport } from "@/components/admin/gedcom-import";
import { requireAdmin } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/import">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.import" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

const FILES = [
  "arbre.ged",
  "personnes.csv",
  "lieux.csv",
  "evenements.csv",
  "sauvegarde.json",
] as const;

// Message keys cannot hold a dot: « arbre.ged » is found under « arbre ».
const stem = (file: string) => file.split(".")[0] as "arbre";

export default async function ImportPage({
  params,
}: PageProps<"/[locale]/admin/import">) {
  const locale = await resolveLocale(params);
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.import" });
  const tExport = await getTranslations({ locale, namespace: "admin.export" });

  return (
    <div className="grid max-w-3xl gap-10">
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("intro")}</p>
      </header>
      <GedcomImport />
      <section
        aria-labelledby="exporter"
        className="grid gap-5 border-t border-hairline pt-8"
      >
        <div className="grid gap-1">
          <h2 id="exporter" className="font-display text-title-sm">
            {tExport("title")}
          </h2>
          <p className="text-caption text-ink-muted">{tExport("intro")}</p>
        </div>
        <ul className="grid gap-px border-y border-hairline bg-hairline">
          {FILES.map((file) => (
            <li key={file} className="bg-paper">
              <a
                href={`/api/export/${file}`}
                download
                className="grid min-h-14 gap-0.5 py-3 transition-colors duration-(--duration-fast) hover:bg-paper-2 md:px-3"
              >
                <span className="font-medium">
                  {tExport(`files.${stem(file)}.title`)}
                </span>
                <span className="text-caption text-ink-muted">
                  {tExport(`files.${stem(file)}.body`)}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-muted">{tExport("demoNote")}</p>
      </section>
    </div>
  );
}
