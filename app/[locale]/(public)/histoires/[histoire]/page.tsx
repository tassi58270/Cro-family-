import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StoryPage } from "@/components/histoires/story-page";
import { loadStory, publicStorySlugs } from "@/lib/data/stories";
import { VISITOR } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";
import { isIndexable } from "@/lib/site";

/**
 * A story to read (6.4). Built in advance for the public; a story about a
 * living relative is loaded in the browser for members, and never indexed.
 */
export async function generateStaticParams() {
  return (await publicStorySlugs()).map((histoire) => ({ histoire }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/histoires/[histoire]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { histoire } = await params;
  const story = await loadStory(VISITOR, histoire, locale);
  if (!story) {
    const t = await getTranslations({ locale, namespace: "stories" });
    return {
      title: t("privateTitle"),
      robots: { index: false, follow: false },
    };
  }
  const indexable = isIndexable() && !story.isDemo;
  return {
    title: story.title.text,
    description: story.excerpt?.text,
    robots: { index: indexable, follow: indexable },
  };
}

export default async function Page({
  params,
}: PageProps<"/[locale]/histoires/[histoire]">) {
  const locale = await resolveLocale(params);
  const { histoire } = await params;
  const story = await loadStory(VISITOR, histoire, locale);
  return (
    <main id="contenu" className="page px-(--gutter) pt-10 pb-28 md:pt-16">
      <StoryPage slug={histoire} locale={locale} initial={story} />
    </main>
  );
}
