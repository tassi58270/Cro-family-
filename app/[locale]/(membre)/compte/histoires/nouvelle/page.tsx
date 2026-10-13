import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StoryEditor } from "@/components/histoires/story-editor";
import { requireMember, viewerOf } from "@/lib/auth/session";
import { placeChoices } from "@/lib/data/story-editor";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/histoires/nouvelle">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  return { title: t("new"), robots: { index: false, follow: false } };
}

export default async function NewStoryPage({
  params,
}: PageProps<"/[locale]/compte/histoires/nouvelle">) {
  const locale = await resolveLocale(params);
  const session = await requireMember(locale);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  const places = await withViewer(viewerOf(session), (q) =>
    placeChoices(q, locale),
  );
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
        <h1 className="font-display text-title-lg">{t("new")}</h1>
        <p className="max-w-2xl text-ink-muted">{t("newIntro")}</p>
      </header>
      <StoryEditor story={null} places={places} locale={locale} mode="member" />
    </main>
  );
}
