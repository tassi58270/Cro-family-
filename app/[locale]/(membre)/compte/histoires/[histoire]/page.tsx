import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StoryEditor } from "@/components/histoires/story-editor";
import { requireMember, viewerOf } from "@/lib/auth/session";
import { editableStory, placeChoices } from "@/lib/data/story-editor";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/histoires/[histoire]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  return { title: t("editTitle"), robots: { index: false, follow: false } };
}

/** A member edits their own story; the database refuses anyone else's. */
export default async function EditStoryPage({
  params,
}: PageProps<"/[locale]/compte/histoires/[histoire]">) {
  const locale = await resolveLocale(params);
  const session = await requireMember(locale);
  const { histoire } = await params;
  if (!UUID.test(histoire)) notFound();
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  const { story, places } = await withViewer(viewerOf(session), async (q) => ({
    story: await editableStory(q, histoire),
    places: await placeChoices(q, locale),
  }));
  if (!story) notFound();
  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-4xl content-start gap-10 py-12 md:py-20"
    >
      <nav className="text-caption">
        <Link
          href="/compte/histoires"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("mine")}
        </Link>
      </nav>
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("editTitle")}</h1>
        <p className="text-caption text-ink-muted">
          {t(`status.${story.status}`)}
        </p>
      </header>
      <StoryEditor
        story={story}
        places={places}
        locale={locale}
        mode="member"
      />
    </main>
  );
}
