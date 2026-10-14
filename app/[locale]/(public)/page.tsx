import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Anecdotes } from "@/components/accueil/anecdotes";
import { Chapters } from "@/components/accueil/chapters";
import { Figures } from "@/components/accueil/figures";
import { Gateways, previews } from "@/components/accueil/gateways";
import { Opening } from "@/components/accueil/opening";
import { Summary } from "@/components/accueil/summary";
import { TitlesFrieze } from "@/components/accueil/titles-frieze";
import { projectInto } from "@/lib/carte/project";
import { loadHome } from "@/lib/data/home";
import { EditLink } from "@/components/ui/edit-link";
import { alternatesFor } from "@/lib/i18n/alternates";
import { resolveLocale } from "@/lib/i18n/server";

// Decorative markers for the map tile while no place has coordinates.
const DEFAULT_MARKERS: [number, number][] = [
  [62, 52],
  [104, 40],
  [138, 72],
  [88, 88],
];

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return { alternates: alternatesFor(locale, "/") };
}

/**
 * Home page (cahier des charges, 6.1). Every text and figure comes from the
 * dashboard; a section the family has not filled yet is simply not shown,
 * so the page stays whole when empty.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "home" });
  const tArms = await getTranslations({ locale, namespace: "arms" });
  const data = await loadHome(locale);
  const count = (key: string) => data.counts[key] ?? 0;

  const tagline = data.tagline ?? { text: t("tagline"), lang: locale };
  const pronunciation = data.pronunciation ?? {
    text: t("pronunciation"),
    lang: locale,
  };

  const sections = [
    data.summary && "en-quelques-lignes",
    data.figures.length > 0 && "en-chiffres",
    data.chapters.length > 0 && "histoire",
    data.titles.length > 0 && "titres",
    data.anecdotes.length > 0 && "le-saviez-vous",
    "explorer",
  ].filter(Boolean) as string[];

  const markers = data.mapPoints
    .map((p) => projectInto(p, 200, 126))
    .filter((p): p is [number, number] => Boolean(p));

  return (
    <main id="contenu" className="flex flex-1 flex-col">
      <EditLink href="/admin/accueil" />
      <Opening
        tagline={tagline}
        pronunciation={pronunciation}
        cueLabel={t("cue")}
        cueTarget={sections[0]}
        skipLabel={t("skip")}
        shieldLabel={tArms("croy")}
      />

      <div className="after-opening">
        {data.summary && (
          <Summary
            id="en-quelques-lignes"
            eyebrow={t("summaryTitle")}
            summary={data.summary}
          />
        )}

        {data.figures.length > 0 && (
          <Figures
            id="en-chiffres"
            title={t("figuresTitle")}
            figures={data.figures}
            locale={locale}
          />
        )}

        {data.chapters.length > 0 && (
          <Chapters
            id="histoire"
            title={t("chaptersTitle")}
            chapters={data.chapters}
            treeLinkLabel={t("treeLink")}
            prologueLabel={t("prologue")}
          />
        )}

        {data.titles.length > 0 && (
          <TitlesFrieze
            id="titres"
            title={t("titlesTitle")}
            titles={data.titles}
            labels={{
              createdBy: t("titles.createdBy"),
              holders: t("titles.holders"),
              noHolder: t("titles.noHolder"),
              turn: t("titles.turn"),
              back: t("titles.back"),
              previous: t("titles.previous"),
              next: t("titles.next"),
            }}
          />
        )}

        {data.anecdotes.length > 0 && (
          <Anecdotes
            id="le-saviez-vous"
            title={t("anecdotesTitle")}
            anecdotes={data.anecdotes}
            readLabel={t("readAnecdote")}
          />
        )}

        <Gateways
          id="explorer"
          title={t("gatewaysTitle")}
          tiles={[
            {
              href: "/arbre",
              title: t("gateways.tree.title"),
              body: t("gateways.tree.body"),
              count: count("people")
                ? t("counts.people", { count: count("people") })
                : null,
              preview: previews.tree(),
            },
            {
              href: "/armoiries",
              title: t("gateways.arms.title"),
              body: t("gateways.arms.body"),
              count: count("branches")
                ? t("counts.branches", { count: count("branches") })
                : null,
              preview: previews.arms(),
            },
            {
              href: "/histoires",
              title: t("gateways.stories.title"),
              body: t("gateways.stories.body"),
              count: count("stories")
                ? t("counts.stories", { count: count("stories") })
                : null,
              preview: previews.stories(),
            },
            {
              href: "/photos",
              title: t("gateways.photos.title"),
              body: t("gateways.photos.body"),
              count: count("photos")
                ? t("counts.photos", { count: count("photos") })
                : null,
              preview: previews.photos(),
            },
            {
              href: "/lieux-et-evenements",
              title: t("gateways.places.title"),
              body: t("gateways.places.body"),
              count: count("places")
                ? t("counts.places", { count: count("places") })
                : null,
              preview: previews.places(
                markers.length ? markers : DEFAULT_MARKERS,
              ),
            },
            {
              href: "/contribuer",
              title: t("gateways.contribute.title"),
              body: t("gateways.contribute.body"),
              preview: previews.contribute(),
            },
          ]}
        />
      </div>
    </main>
  );
}
