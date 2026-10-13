import { useTranslations } from "next-intl";
import { BandsRule } from "@/components/ui/bands";
import type { StoryCard as Story } from "@/lib/data/stories";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

/** « 1879 – 1921 », « 1415 », or nothing. */
export function eraLabel(start: number | null, end: number | null) {
  if (start && end && end !== start) return `${start} – ${end}`;
  return start ? String(start) : end ? String(end) : "";
}

/**
 * A story in the magazine (6.4): image, title, era, excerpt and the people
 * concerned as small chips. The whole card opens the story; the chips open
 * the people's pages.
 */
export function StoryCard({
  story,
  size = "medium",
  headingLevel: Heading = "h3",
}: {
  story: Story;
  size?: "featured" | "large" | "medium" | "small";
  headingLevel?: "h2" | "h3";
}) {
  const t = useTranslations("stories");
  const era = eraLabel(story.eraStart, story.eraEnd);
  const big = size === "featured" || size === "large";

  return (
    <article
      className={cn(
        "group relative grid content-start gap-4",
        size === "featured" &&
          "md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:gap-12",
      )}
    >
      {story.cover ? (
        <div
          className={cn(
            "overflow-hidden rounded-xs bg-paper-2",
            size === "featured"
              ? "aspect-[4/3]"
              : big
                ? "aspect-[16/10]"
                : "aspect-[4/3]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- served at the right size by /fichiers. */}
          <img
            src={`${story.cover.url}?l=${big ? 1280 : 640}`}
            alt=""
            loading={size === "featured" ? "eager" : "lazy"}
            className="size-full object-cover transition-transform duration-(--duration-slow) ease-out group-hover:scale-[1.02]"
          />
        </div>
      ) : (
        size === "featured" && (
          <div
            aria-hidden="true"
            className="grid aspect-[4/3] place-items-center rounded-xs bg-paper-2 max-md:hidden"
          >
            <BandsRule className="w-24 gap-2 [&>span]:h-[6px]" />
          </div>
        )
      )}
      <div
        className={cn(
          "grid content-start gap-3",
          !story.cover &&
            size !== "featured" &&
            "border-t-[3px] border-croy pt-5",
        )}
      >
        {(era || story.themes.length > 0) && (
          <p className="flex flex-wrap items-baseline gap-x-3 text-caption text-ink-muted">
            {era && (
              <span
                className={cn(
                  "tabular font-display text-croy-text",
                  big ? "text-title-sm" : "text-[1.25rem]",
                )}
              >
                {era}
              </span>
            )}
            {story.themes.map((theme) => (
              <span key={theme}>{t(`themes.${theme}`)}</span>
            ))}
          </p>
        )}
        <Heading
          className={cn(
            "font-display text-balance",
            size === "featured"
              ? "text-title-lg"
              : big
                ? "text-title"
                : "text-title-sm",
          )}
          lang={story.title.lang}
        >
          <Link
            href={{
              pathname: "/histoires/[histoire]",
              params: { histoire: story.slug },
            }}
            className="decoration-croy decoration-[2px] underline-offset-[0.18em] group-hover:underline after:absolute after:inset-0"
          >
            {story.title.text}
          </Link>
        </Heading>
        {story.excerpt && size !== "small" && (
          <p
            className={cn("text-ink-muted", size === "featured" && "text-lead")}
            lang={story.excerpt.lang}
          >
            {story.excerpt.text}
          </p>
        )}
        {story.people.length > 0 && (
          <ul
            className="relative z-10 flex flex-wrap gap-1.5"
            aria-label={t("people")}
          >
            {story.people.slice(0, size === "small" ? 2 : 4).map((p) => (
              <li key={p.slug}>
                <Link
                  href={{
                    pathname: "/arbre/[personne]",
                    params: { personne: p.slug },
                  }}
                  className="inline-flex min-h-8 items-center rounded-full border border-hairline px-3 text-[0.8125rem] font-medium transition-colors duration-(--duration-fast) hover:border-ink"
                >
                  {p.name}
                </Link>
              </li>
            ))}
            {story.people.length > (size === "small" ? 2 : 4) && (
              <li className="inline-flex min-h-8 items-center px-1 text-[0.8125rem] text-ink-muted">
                {t("morePeople", {
                  count: story.people.length - (size === "small" ? 2 : 4),
                })}
              </li>
            )}
          </ul>
        )}
        {story.isDemo && (
          <p className="text-caption text-croy-text">{t("demo")}</p>
        )}
      </div>
    </article>
  );
}
