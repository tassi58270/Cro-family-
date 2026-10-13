import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StoryList } from "@/components/histoires/story-list";
import { ButtonLink } from "@/components/ui/button";
import { requireMember, viewerOf } from "@/lib/auth/session";
import { storyList } from "@/lib/data/story-editor";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/histoires">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  return { title: t("mine"), robots: { index: false, follow: false } };
}

/** A member's own stories: drafts, those waiting for validation, published ones. */
export default async function MyStoriesPage({
  params,
}: PageProps<"/[locale]/compte/histoires">) {
  const locale = await resolveLocale(params);
  const session = await requireMember(locale);
  const t = await getTranslations({ locale, namespace: "storyEditor" });
  const stories = await withViewer(viewerOf(session), (q) =>
    storyList(q, session.accountId),
  );
  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-4xl content-start gap-10 py-12 md:py-20"
    >
      <nav className="text-caption">
        <Link
          href="/compte"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("account")}
        </Link>
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-3">
          <h1 className="font-display text-title-lg">{t("mine")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("mineIntro")}</p>
        </div>
        <ButtonLink href="/compte/histoires/nouvelle">{t("new")}</ButtonLink>
      </header>
      <StoryList stories={stories} mode="member" />
    </main>
  );
}
