import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomeEditor } from "@/components/admin/home-editor";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { adminHome } from "@/lib/data/admin-home";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/accueil">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.home" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function HomeEditorPage({
  params,
}: PageProps<"/[locale]/admin/accueil">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const data = await withViewer(viewerOf(session), adminHome);
  return <HomeEditor data={data} />;
}
