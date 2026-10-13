import { useTranslations } from "next-intl";
import { initials } from "@/components/ui/chip";
import type { StoryDetail } from "@/lib/data/story-types";
import { Link } from "@/lib/i18n/navigation";
import { eraLabel, StoryCard } from "./story-card";

/**
 * The reading page of a story (6.4): a comfortable column, a large image,
 * the people concerned in the margin with their sheet on hover, the places
 * and events below, then neighbouring stories.
 */
export function StoryReader({
  story,
  locale,
}: {
  story: StoryDetail;
  locale: string;
}) {
  const t = useTranslations("stories");
  const tLang = useTranslations("common.languages");
  const era = eraLabel(story.eraStart, story.eraEnd);
  const paragraphs =
    story.body?.text.split(/\n\s*\n/).filter((p) => p.trim()) ?? [];
  const translated = story.title.lang !== story.originalLocale;

  return (
    <article className="grid gap-12 md:gap-16">
      <header className="mx-auto grid w-full max-w-4xl gap-5 text-center">
        <p className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-caption text-ink-muted">
          {era && (
            <span className="tabular font-display text-title-sm text-croy-text">
              {era}
            </span>
          )}
          {story.themes.map((theme) => (
            <span key={theme}>{t(`themes.${theme}`)}</span>
          ))}
        </p>
        <h1
          className="font-display text-title-lg text-balance"
          lang={story.title.lang}
        >
          {story.title.text}
        </h1>
        {story.excerpt && (
          <p
            className="mx-auto max-w-2xl text-lead text-ink-muted"
            lang={story.excerpt.lang}
          >
            {story.excerpt.text}
          </p>
        )}
        <p className="text-caption text-ink-muted">
          {[
            story.author ? t("by", { name: story.author }) : t("anonymous"),
            story.publishedAt &&
              new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                new Date(story.publishedAt),
              ),
            translated &&
              t("writtenIn", { language: tLang(story.originalLocale) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {story.isDemo && (
          <p className="text-caption text-croy-text">{t("demo")}</p>
        )}
        {story.status !== "published" && (
          <p className="mx-auto rounded-full border border-hairline-strong px-3 text-caption leading-8">
            {t("notPublished")}
          </p>
        )}
      </header>

      {story.cover && (
        <figure className="-mx-(--gutter) grid gap-2 md:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- served at the right size by /fichiers. */}
          <img
            src={`${story.cover.url}?l=2048`}
            alt={story.cover.alt}
            className="max-h-[80svh] w-full object-cover md:rounded-xs"
          />
        </figure>
      )}

      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
        {story.people.length > 0 && (
          <aside
            aria-labelledby="personnes"
            className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:order-2 lg:self-start"
          >
            <h2
              id="personnes"
              className="mb-3 text-caption font-medium text-ink-muted"
            >
              {t("inThisStory")}
            </h2>
            <ul className="flex flex-wrap gap-2 lg:grid lg:gap-1">
              {story.people.map((p) => (
                <li key={p.slug} className="group relative">
                  <Link
                    href={{
                      pathname: "/arbre/[personne]",
                      params: { personne: p.slug },
                    }}
                    className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-hairline py-1 pr-4 pl-1 lg:w-full lg:rounded-xs lg:border-transparent lg:hover:border-hairline"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 font-display text-[0.8125rem]"
                    >
                      {initials(p.name)}
                    </span>
                    <span className="grid text-left">
                      <span className="text-caption font-medium">{p.name}</span>
                      {p.years && (
                        <span className="tabular text-[0.8125rem] text-ink-muted max-lg:hidden">
                          {p.years}
                        </span>
                      )}
                    </span>
                  </Link>
                  {/* The sheet in brief, on hover or keyboard focus. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none invisible absolute top-0 right-full z-20 mr-3 w-64 translate-x-1 rounded-xs border border-hairline bg-paper p-4 opacity-0 shadow-(--shadow-panel) transition-[opacity,transform,visibility] duration-(--duration-fast) ease-out max-lg:hidden lg:group-focus-within:visible lg:group-focus-within:translate-x-0 lg:group-focus-within:opacity-100 lg:group-hover:visible lg:group-hover:translate-x-0 lg:group-hover:opacity-100"
                  >
                    <p className="font-display text-[1.25rem] leading-tight">
                      {p.name}
                    </p>
                    {p.years && (
                      <p className="tabular mt-1 text-caption text-ink-muted">
                        {p.years}
                      </p>
                    )}
                    {p.branchName && (
                      <p className="mt-2 text-caption">{p.branchName}</p>
                    )}
                    <p className="mt-3 text-caption font-medium text-croy-text">
                      {t("openSheet")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <div
          className="story-body grid max-w-[38rem] gap-6 text-[1.125rem] leading-[1.75] md:text-[1.1875rem] lg:order-1"
          lang={story.body?.lang}
        >
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
          {story.source && (
            <p className="border-t border-hairline pt-5 text-caption text-ink-muted">
              <span className="font-medium">{t("source")} </span>
              {story.source}
            </p>
          )}
        </div>
      </div>

      {story.photos.length > (story.cover ? 1 : 0) && (
        <section
          aria-labelledby="photos"
          className="mx-auto grid w-full max-w-5xl gap-4"
        >
          <h2 id="photos" className="text-caption font-medium text-ink-muted">
            {t("photos")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {story.photos.slice(story.cover ? 1 : 0).map((photo) => (
              <li key={photo.id}>
                <Link
                  href={{
                    pathname: "/photos/[photo]",
                    params: { photo: photo.id },
                  }}
                  className="group grid gap-2"
                >
                  <span className="block aspect-[4/3] overflow-hidden rounded-xs bg-paper-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                    <img
                      src={`${photo.url}?l=640`}
                      alt={photo.caption ?? ""}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-(--duration-slow) ease-out group-hover:scale-[1.03]"
                    />
                  </span>
                  {photo.caption && (
                    <span className="text-caption text-ink-muted">
                      {photo.caption}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(story.places.length > 0 || story.events.length > 0) && (
        <section
          aria-labelledby="lieux"
          className="mx-auto grid w-full max-w-5xl gap-4 border-t border-hairline pt-8"
        >
          <h2 id="lieux" className="text-caption font-medium text-ink-muted">
            {t("placesAndEvents")}
          </h2>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {story.events.map((e) => (
              <li key={e.slug} className="flex items-baseline gap-2">
                {e.year && (
                  <span className="tabular font-display text-croy-text">
                    {e.year}
                  </span>
                )}
                <span>{e.title}</span>
              </li>
            ))}
            {story.places.map((p) => (
              <li key={p.slug}>
                <Link
                  href={{ pathname: "/lieux/[lieu]", params: { lieu: p.slug } }}
                  className="link"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {story.neighbours.length > 0 && (
        <section
          aria-labelledby="voisines"
          className="grid gap-8 border-t border-hairline pt-10"
        >
          <h2 id="voisines" className="font-display text-title">
            {t("neighbours")}
          </h2>
          <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
            {story.neighbours.map((n) => (
              <StoryCard key={n.slug} story={n} size="small" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
