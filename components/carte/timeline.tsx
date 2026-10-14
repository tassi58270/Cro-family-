"use client";

import { useTranslations } from "next-intl";
import { PersonChip } from "@/components/ui/chip";
import { Tremas } from "@/components/ui/bands";
import { centuryLabel } from "@/lib/genealogie/tree-model";
import type { MapPlace, TimelineEvent } from "@/lib/data/place-types";
import { byCentury } from "@/lib/carte/timeline";
import { cn } from "@/lib/design/cn";
import { formatFuzzyDate } from "@/lib/genealogie/dates";
import { Link } from "@/lib/i18n/navigation";

/** « vers », « avant »… above the year, and the full date when it is known. */
export function dateParts(event: TimelineEvent, locale: string) {
  if (!event.date || event.year === null) return null;
  const year = String(event.year);
  const full = formatFuzzyDate(event.date, locale);
  const precise = ["day", "month"].includes(event.date.precision);
  const qualifier = ["about", "before", "after"].includes(event.date.precision)
    ? full.replace(year, "").trim()
    : null;
  return { year, qualifier, full: precise ? full : null };
}

export function eventId(slug: string) {
  return `evenement-${slug}`;
}

/**
 * The timeline (6.6): every event by century, those of the chosen place
 * marked by the two red dots, the open one with its people and stories.
 */
export function Timeline({
  events,
  places,
  active,
  highlighted,
  locale,
  onOpen,
}: {
  events: TimelineEvent[];
  places: Map<string, MapPlace>;
  active: string | null;
  highlighted: string | null;
  locale: string;
  onOpen: (event: TimelineEvent) => void;
}) {
  const t = useTranslations("places");
  return (
    <div className="grid gap-2">
      {byCentury(events).map((group) => (
        <section key={group.century ?? "undated"} className="grid">
          <h3 className="sticky top-0 z-10 -mx-1 bg-paper/95 px-1 py-2 text-caption font-medium text-ink-muted backdrop-blur-sm">
            {group.century === null
              ? t("undated")
              : centuryLabel(group.century, locale)}
          </h3>
          <ol className="grid border-l border-hairline">
            {group.items.map((event) => {
              const place = event.placeId
                ? places.get(event.placeId)
                : undefined;
              const open = event.id === active;
              const here =
                highlighted !== null && event.placeId === highlighted;
              const date = dateParts(event, locale);
              return (
                <li
                  key={event.id}
                  id={eventId(event.slug)}
                  data-event={event.slug}
                  data-highlight={here || undefined}
                  className="timeline-item relative scroll-mt-14"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-[1.15rem] -left-px -translate-x-1/2",
                      here || open
                        ? ""
                        : "size-1.5 rounded-full bg-hairline-strong",
                    )}
                  >
                    {(here || open) && (
                      <Tremas className="rounded-full bg-paper px-0.5 py-0.5 text-[0.9rem]" />
                    )}
                  </span>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${eventId(event.slug)}-detail`}
                    onClick={() => onOpen(event)}
                    className={cn(
                      "grid min-h-11 w-full grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-r-xs py-2.5 pr-2 pl-4 text-left",
                      "transition-colors duration-(--duration-fast) ease-out hover:bg-paper-2",
                      (open || here) && "bg-paper-2",
                    )}
                  >
                    <span className="grid content-start leading-none">
                      {date?.qualifier && (
                        <span className="text-[0.75rem] text-ink-muted">
                          {date.qualifier}
                        </span>
                      )}
                      <span className="font-display text-title-sm text-croy-text tabular-nums">
                        {date?.year ?? "—"}
                      </span>
                    </span>
                    <span className="grid gap-0.5">
                      <span className="font-medium" lang={event.title.lang}>
                        {event.title.text}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {[
                          t(`kinds.${event.kind}`),
                          place?.name.text,
                          date?.full,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {event.isDemo && (
                          <span className="ml-2 text-croy-text">
                            {t("demo")}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div
                      id={`${eventId(event.slug)}-detail`}
                      className="grid gap-4 pt-1 pr-2 pb-5 pl-[5.5rem]"
                    >
                      {event.description && (
                        <p
                          lang={event.description.lang}
                          className="max-w-prose whitespace-pre-line"
                        >
                          {event.description.text}
                        </p>
                      )}
                      {event.people.length > 0 && (
                        <ul
                          className="flex flex-wrap gap-2"
                          aria-label={t("people")}
                        >
                          {event.people.map((p) => (
                            <li key={p.slug} className="max-w-full">
                              <PersonChip
                                name={p.name}
                                href={{
                                  pathname: "/arbre/[personne]",
                                  params: { personne: p.slug },
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                      {event.stories.length > 0 && (
                        <ul className="grid gap-1" aria-label={t("stories")}>
                          {event.stories.map((s) => (
                            <li key={s.slug}>
                              <Link
                                href={{
                                  pathname: "/histoires/[histoire]",
                                  params: { histoire: s.slug },
                                }}
                                className="link"
                                lang={s.title.lang}
                              >
                                {s.title.text}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      {place && (
                        <p>
                          <Link
                            href={{
                              pathname: "/lieux/[lieu]",
                              params: { lieu: place.slug },
                            }}
                            className="link text-caption font-medium"
                          >
                            {place.name.text}
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
