import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TreeSettings } from "@/components/admin/tree-settings";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadTreeSettings } from "@/lib/data/admin-tree";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/lignees">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.lineages" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Entry points of the tree and lineages shown link by link with their proofs. */
export default async function TreeSettingsPage({
  params,
}: PageProps<"/[locale]/admin/lignees">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const { entries, lineages } = await withViewer(
    viewerOf(session),
    loadTreeSettings,
  );
  return <TreeSettings entries={entries} lineages={lineages} locale={locale} />;
}
