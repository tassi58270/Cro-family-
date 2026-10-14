import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnecdotesAdmin } from "@/components/admin/anecdotes-admin";
import { StoryList } from "@/components/histoires/story-list";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadAnecdotes } from "@/lib/data/anecdotes";
import { placeChoices, storyList } from "@/lib/data/story-editor";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/histoires">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  return { title: t("adminTitle"), robots: { index: false, follow: false } };
}

/** Every story: those waiting for validation first. */
export default async function AdminStoriesPage({
  params,
}: PageProps<"/[locale]/admin/histoires">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  const { stories, anecdotes, places } = await withViewer(
    viewerOf(session),
    async (q) => ({
      stories: await storyList(q),
      anecdotes: await loadAnecdotes(q),
      places: await placeChoices(q, locale),
    }),
  );
  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <h1 className="font-display text-title">{t("adminTitle")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("adminIntro")}</p>
        </div>
        <ButtonLink href="/compte/histoires/nouvelle" variant="secondary">
          {t("new")}
        </ButtonLink>
      </header>
      <AnecdotesAdmin anecdotes={anecdotes} places={places} locale={locale} />
      <section
        aria-labelledby="histoires"
        className="grid gap-5 border-t border-hairline pt-8"
      >
        <h2 id="histoires" className="font-display text-title-sm">
          {t("storiesTitle")}
        </h2>
        <StoryList stories={stories} mode="admin" />
      </section>
    </div>
  );
}
