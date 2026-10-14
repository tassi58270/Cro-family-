import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArmsEditor } from "@/components/admin/arms-editor";
import { TitlesAdmin } from "@/components/admin/titles-admin";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadAdminArms } from "@/lib/data/admin-arms";
import { loadAdminTitles } from "@/lib/data/admin-titles";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/armoiries">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.arms" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Branches and coats of arms, as shown on the arms page and in the tree. */
export default async function ArmsEditorPage({
  params,
}: PageProps<"/[locale]/admin/armoiries">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const { branches, arms, titles } = await withViewer(
    viewerOf(session),
    async (q) => ({
      ...(await loadAdminArms(q)),
      titles: await loadAdminTitles(q),
    }),
  );
  return (
    <div className="grid gap-12">
      <ArmsEditor branches={branches} arms={arms} locale={locale} />
      <TitlesAdmin
        titles={titles}
        branches={branches.map((b) => ({
          id: b.id,
          name: b.texts.fr.name || b.slug,
        }))}
        locale={locale}
      />
    </div>
  );
}
