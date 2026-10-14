"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Tremas } from "@/components/ui/bands";
import { ButtonLink } from "@/components/ui/button";
import { PersonChip } from "@/components/ui/chip";
import type { LinkedPerson, PlaceDetail } from "@/lib/data/place-types";
import { Link } from "@/lib/i18n/navigation";
import { usePeriod } from "./place-card";
import { dateParts } from "./timeline";
import { EditLink } from "@/components/ui/edit-link";

function People({ title, people }: { title: string; people: LinkedPerson[] }) {
  if (!people.length) return null;
  return (
    <div className="grid gap-3">
      <h3 className="text-caption font-medium text-ink-muted">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {people.map((p) => (
          <li key={p.slug} className="max-w-full">
            <PersonChip
              name={p.years ? `${p.name} (${p.years})` : p.name}
              href={{
                pathname: "/arbre/[personne]",
                params: { personne: p.slug },
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-hairline pt-8">
      <h2 className="font-display text-title-sm">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A place (6.6): what the family wrote about it, what happened there, who
 * was born, lived or died there, the stories and photos. Members also see
 * their living relatives, loaded in the browser.
 */
export function PlacePage({
  initial,
  locale,
  locator,
}: {
  initial: PlaceDetail;
  locale: string;
  /** The small map, drawn on the server when the place has coordinates. */
  locator: ReactNode;
}) {
  const t = useTranslations("places");
  const period = usePeriod();
  const [place, setPlace] = useState(initial);

  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c.startsWith("croy_membre=")))
      return;
    fetch(`/api/lieu/${encodeURIComponent(initial.slug)}?langue=${locale}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<PlaceDetail>) : null))
      .then((detail) => detail && setPlace(detail))
      .catch(() => {});
  }, [initial.slug, locale]);

  const label = period(place);
  const hasPeople =
    place.linked.length + place.born.length + place.died.length > 0;
  const nothing = !place.description && !place.events.length && !hasPeople;
  const [hero, ...photos] = place.photos;

  return (
    <article className="grid gap-12">
      <EditLink href="/admin/lieux" />
      <nav className="text-caption">
        <Link
          href="/lieux-et-evenements"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("place.back")}
        </Link>
      </nav>

      <header className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid content-start gap-5">
          <p className="text-caption font-medium text-croy-text">
            {[t(`placeKinds.${place.kind}`), label].filter(Boolean).join(" · ")}
            {place.isDemo && (
              <span className="ml-3 font-normal text-ink-muted">
                {t("demo")}
              </span>
            )}
          </p>
          <h1 lang={place.name.lang} className="font-display text-title-lg">
            {place.name.text}
          </h1>
          {place.visitable && (
            <p className="flex items-center gap-2 font-medium">
              <Tremas />
              {t("place.visitable")}
            </p>
          )}
          {place.description && (
            <div
              lang={place.description.lang}
              className="grid max-w-prose gap-4 text-lead"
            >
              {place.description.text.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
          {nothing && <p className="text-ink-muted">{t("place.empty")}</p>}
          <div className="flex flex-wrap gap-3">
            {place.lat !== null && (
              <ButtonLink
                href={{
                  pathname: "/lieux-et-evenements",
                  query: { lieu: place.slug },
                }}
                variant="secondary"
              >
                {t("place.showOnMap")}
              </ButtonLink>
            )}
            <ButtonLink href="/contribuer" variant="ghost">
              {t("place.contribute")}
            </ButtonLink>
          </div>
        </div>
        {locator}
      </header>

      {hero && (
        <figure className="grid gap-2">
          <Link
            href={{ pathname: "/photos/[photo]", params: { photo: hero.id } }}
            className="block overflow-hidden rounded-xs bg-paper-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
            <img
              src={`/fichiers/${hero.path}?l=1280`}
              srcSet={`/fichiers/${hero.path}?l=640 640w, /fichiers/${hero.path}?l=1280 1280w, /fichiers/${hero.path}?l=2048 2048w`}
              sizes="(min-width: 1024px) 80vw, 100vw"
              alt={hero.caption?.text ?? ""}
              width={hero.width ?? undefined}
              height={hero.height ?? undefined}
              className="max-h-[70svh] w-full object-cover"
            />
          </Link>
          {hero.caption && (
            <figcaption
              lang={hero.caption.lang}
              className="text-caption text-ink-muted"
            >
              {hero.caption.text}
            </figcaption>
          )}
        </figure>
      )}

      {place.visitable && place.visitInfo && (
        <Section title={t("place.visit")}>
          <p
            lang={place.visitInfo.lang}
            className="max-w-prose whitespace-pre-line"
          >
            {place.visitInfo.text}
          </p>
        </Section>
      )}

      {place.events.length > 0 && (
        <Section title={t("place.events")}>
          <ol className="grid border-l border-hairline">
            {place.events.map((e) => {
              const date = dateParts(e, locale);
              return (
                <li key={e.id}>
                  <Link
                    href={{
                      pathname: "/lieux-et-evenements",
                      query: { evenement: e.slug },
                    }}
                    className="grid min-h-11 grid-cols-[4.75rem_minmax(0,1fr)] gap-3 rounded-r-xs py-3 pr-2 pl-4 transition-colors duration-(--duration-fast) hover:bg-paper-2"
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
                      <span lang={e.title.lang} className="font-medium">
                        {e.title.text}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {[t(`kinds.${e.kind}`), date?.full]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {hasPeople && (
        <Section title={t("people")}>
          <People title={t("place.linked")} people={place.linked} />
          <People title={t("place.born")} people={place.born} />
          <People title={t("place.died")} people={place.died} />
        </Section>
      )}

      {place.stories.length > 0 && (
        <Section title={t("place.stories")}>
          <ul className="grid gap-2">
            {place.stories.map((s) => (
              <li key={s.slug}>
                <Link
                  href={{
                    pathname: "/histoires/[histoire]",
                    params: { histoire: s.slug },
                  }}
                  lang={s.title.lang}
                  className="link font-display text-title-sm"
                >
                  {s.title.text}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {photos.length > 0 && (
        <Section title={t("place.photos")}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id}>
                <Link
                  href={{
                    pathname: "/photos/[photo]",
                    params: { photo: p.id },
                  }}
                  className="block aspect-square overflow-hidden rounded-xs bg-paper-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                  <img
                    src={`/fichiers/${p.path}?l=320`}
                    alt={p.caption?.text ?? ""}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-(--duration-base) ease-out hover:scale-[1.03]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
