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

export default async function ImportPage({
  params,
}: PageProps<"/[locale]/admin/import">) {
  const locale = await resolveLocale(params);
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.import" });

  return (
    <div className="grid max-w-3xl gap-10">
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("intro")}</p>
      </header>
      <GedcomImport />
    </div>
  );
}
