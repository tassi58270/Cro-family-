"use client";

import { useTranslations } from "next-intl";
import { Tremas } from "@/components/ui/bands";
import { PersonChip } from "@/components/ui/chip";
import type { MapPlace, TimelineEvent } from "@/lib/data/place-types";
import { periodLabel } from "@/lib/carte/timeline";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

export function usePeriod() {
  const t = useTranslations("places");
  return (place: Pick<MapPlace, "periodStart" | "periodEnd">) =>
    periodLabel(place.periodStart, place.periodEnd, {
      since: (year) => t("since", { year: String(year) }),
      until: (year) => t("until", { year: String(year) }),
    });
}

/**
 * What a click on a place shows over the map: photo, description, period,
 * its events (each one goes to the timeline), people and stories.
 */
export function PlaceCard({
  place,
  events,
  activeEvent,
  onEvent,
  onClose,
  className,
}: {
  place: MapPlace;
  events: TimelineEvent[];
  activeEvent: string | null;
  onEvent: (event: TimelineEvent) => void;
  onClose: () => void;
  className?: string;
}) {
  const t = useTranslations("places");
  const period = usePeriod()(place);
  return (
    <section
      aria-labelledby="carte-lieu-titre"
      className={cn(
        "grid content-start overflow-y-auto overscroll-contain rounded-xs border border-hairline bg-paper shadow-[0_8px_30px_rgb(0_0_0/0.12)]",
        className,
      )}
    >
      {place.photo && (
        // eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers.
        <img
          src={`/fichiers/${place.photo.path}?l=640`}
          alt={place.photo.caption?.text ?? ""}
          className="hidden aspect-[16/9] w-full bg-paper-2 object-cover md:block"
        />
      )}
      <div className="grid gap-3 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="text-caption text-ink-muted">
              {[t(`placeKinds.${place.kind}`), period]
                .filter(Boolean)
                .join(" · ")}
              {place.isDemo && (
                <span className="ml-2 text-croy-text">{t("demo")}</span>
              )}
            </p>
            <h2
              id="carte-lieu-titre"
              lang={place.name.lang}
              className="font-display text-title-sm"
            >
              {place.name.text}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors duration-(--duration-fast) hover:bg-paper-2 hover:text-ink"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>
        {place.visitable && (
          <p className="flex items-center gap-2 text-caption font-medium">
            <Tremas />
            {t("visitable")}
          </p>
        )}
        {place.summary && (
          <p
            lang={place.summary.lang}
            className="hidden text-ink-muted md:block"
          >
            {place.summary.text}
          </p>
        )}
        {events.length > 0 && (
          <ul
            className="grid"
            aria-label={t("eventsHere", { count: events.length })}
          >
            {events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onEvent(e)}
                  aria-pressed={e.id === activeEvent}
                  className={cn(
                    "grid min-h-11 w-full grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-2 rounded-xs px-2 py-1.5 text-left",
                    "transition-colors duration-(--duration-fast) hover:bg-paper-2",
                    e.id === activeEvent && "bg-paper-2",
                  )}
                >
                  <span className="font-display text-croy-text tabular-nums">
                    {e.year ?? "—"}
                  </span>
                  <span lang={e.title.lang} className="truncate">
                    {e.title.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {place.people.length > 0 && (
          <ul
            className="hidden flex-wrap gap-2 md:flex"
            aria-label={t("people")}
          >
            {place.people.slice(0, 6).map((p) => (
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
        {place.stories.length > 0 && (
          <ul className="hidden gap-1 md:grid" aria-label={t("stories")}>
            {place.stories.map((s) => (
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
        <p>
          <Link
            href={{ pathname: "/lieux/[lieu]", params: { lieu: place.slug } }}
            className="link text-caption font-medium"
          >
            {t("placeLink")}
          </Link>
        </p>
      </div>
    </section>
  );
}
