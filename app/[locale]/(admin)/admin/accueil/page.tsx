import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnecdotesAdmin } from "@/components/admin/anecdotes-admin";
import { HomeEditor } from "@/components/admin/home-editor";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { adminHome } from "@/lib/data/admin-home";
import { loadAnecdotes } from "@/lib/data/anecdotes";
import { placeChoices } from "@/lib/data/story-editor";
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
  const { data, anecdotes, places } = await withViewer(
    viewerOf(session),
    async (q) => ({
      data: await adminHome(q),
      anecdotes: await loadAnecdotes(q),
      places: await placeChoices(q, locale),
    }),
  );
  return (
    <div className="grid gap-12">
      <HomeEditor data={data} />
      <AnecdotesAdmin anecdotes={anecdotes} places={places} locale={locale} />
    </div>
  );
}
