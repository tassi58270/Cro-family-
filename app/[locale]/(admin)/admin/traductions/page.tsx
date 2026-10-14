import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TranslationsAdmin } from "@/components/admin/translations-admin";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import {
  loadTranslation,
  loadTranslations,
  TRANSLATABLE_KINDS,
  type TranslatableKind,
} from "@/lib/data/translations";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/traductions">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.translations" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The family's texts in three languages, side by side (section 7). */
export default async function TranslationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/traductions">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const query = await searchParams;
  const kind = (TRANSLATABLE_KINDS as string[]).includes(String(query.sorte))
    ? (query.sorte as TranslatableKind)
    : null;
  const all = query.tout === "1";
  const [openKind, openId] = String(query.ouvrir ?? "").split(":");
  const { rows, item } = await withViewer(viewerOf(session), async (q) => ({
    rows: await loadTranslations(q, kind, all),
    item:
      (TRANSLATABLE_KINDS as string[]).includes(openKind) && openId
        ? await loadTranslation(q, openKind as TranslatableKind, openId)
        : null,
  }));
  return (
    <TranslationsAdmin
      rows={rows}
      item={item}
      kind={kind}
      all={all}
      kinds={TRANSLATABLE_KINDS}
    />
  );
}
