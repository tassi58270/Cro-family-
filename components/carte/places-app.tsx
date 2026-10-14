"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Tremas } from "@/components/ui/bands";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  EventKind,
  MapPlace,
  PlacesIndex,
  TimelineEvent,
} from "@/lib/data/place-types";
import {
  activeTimelineFilters,
  centuriesOf,
  kindsOf,
  matchesTimeline,
  NO_TIMELINE_FILTERS,
  onMap,
  readingSequence,
  type TimelineFilters,
} from "@/lib/carte/timeline";
import { cn } from "@/lib/design/cn";
import { centuryLabel } from "@/lib/genealogie/tree-model";
import { Link } from "@/lib/i18n/navigation";
import { MapView, type Inset, type MapApi, type MapPoint } from "./map-view";
import { PlaceCard, usePeriod } from "./place-card";
import { dateParts, eventId, Timeline } from "./timeline";

type Tab = "timeline" | "places";
type Reading = { index: number; playing: boolean };

const DWELL = 4200;

function placeItemId(slug: string) {
  return `lieu-${slug}`;
}

/** What will cover the map once it has flown: the card, or the reading caption. */
function inset(over: "card" | "reading"): Inset {
  if (window.matchMedia("(min-width: 1024px)").matches) return { left: 400 };
  return over === "card" ? { bottom: 190 } : { top: 130 };
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The Places and events page (6.6): the map and the timeline side by side,
 * each leading to the other, and « Lecture », which plays the story on the
 * map in chronological order. The state lives in the address.
 */
export function PlacesApp({
  initial,
  locale,
  emptyAction,
}: {
  initial: PlacesIndex;
  locale: string;
  emptyAction: ReactNode;
}) {
  const t = useTranslations("places");
  const period = usePeriod();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("timeline");
  const [filters, setFilters] = useState<TimelineFilters>(NO_TIMELINE_FILTERS);
  const [place, setPlace] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [visitableOnly, setVisitableOnly] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const map = useRef<MapApi | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<string | null>(null);
  const started = useRef(false);

  const places = useMemo(
    () => new Map(data.places.map((p) => [p.id, p])),
    [data.places],
  );
  const points = useMemo<MapPoint[]>(
    () =>
      data.places.filter(onMap).map((p) => ({
        id: p.id,
        name: p.name.text,
        lat: p.lat,
        lng: p.lng,
      })),
    [data.places],
  );
  const filtered = useMemo(
    () => data.events.filter((e) => matchesTimeline(e, filters)),
    [data.events, filters],
  );
  const sequence = useMemo(
    () => readingSequence(filtered, places),
    [filtered, places],
  );
  const filtering = activeTimelineFilters(filters) > 0;

  // Unlit places: those the reading has not reached, or that the filters leave out.
  const dimmed = useMemo(() => {
    if (reading) {
      const reached = new Set(
        sequence.slice(0, reading.index + 1).map((e) => e.placeId),
      );
      return new Set(points.map((p) => p.id).filter((id) => !reached.has(id)));
    }
    if (!filtering) return new Set<string>();
    const kept = new Set(filtered.map((e) => e.placeId));
    return new Set(points.map((p) => p.id).filter((id) => !kept.has(id)));
  }, [reading, sequence, filtering, filtered, points]);

  const chosen = place ? places.get(place) : undefined;
  const chosenEvents = useMemo(
    () => (place ? data.events.filter((e) => e.placeId === place) : []),
    [data.events, place],
  );

  // ── Address ────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const placeSlug = params.get("lieu");
    const eventSlug = params.get("evenement");
    const event = data.events.find((e) => e.slug === eventSlug);
    const fromAddress =
      data.places.find((p) => p.slug === placeSlug) ??
      (event?.placeId ? places.get(event.placeId) : undefined);
    // The state asked for in the address, read once in the browser.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (params.get("vue") === "lieux") setTab("places");
    if (event) setActive(event.id);
    if (fromAddress) setPlace(fromAddress.id);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (event) pendingScroll.current = eventId(event.slug);
    else if (fromAddress) pendingScroll.current = placeItemId(fromAddress.slug);
    // Only the first load reads the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return;
    }
    const url = new URL(window.location.href);
    const set = (key: string, value: string | null | undefined) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    };
    set("lieu", chosen?.slug);
    set("evenement", data.events.find((e) => e.id === active)?.slug);
    set("vue", tab === "places" ? "lieux" : null);
    window.history.replaceState(window.history.state, "", url);
  }, [chosen, active, tab, data.events]);

  // Members also see what involves living relatives.
  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c.startsWith("croy_membre=")))
      return;
    fetch(`/api/lieux/${locale}/membres`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PlacesIndex>) : null))
      .then((index) => index && setData(index))
      .catch(() => {});
  }, [locale]);

  // The page fills the screen below the menu and the demonstration banner.
  useLayoutEffect(() => {
    const measure = () => {
      const top = shell.current?.getBoundingClientRect().top;
      if (top !== undefined) setOffset(Math.round(top + window.scrollY));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // After each change, the item it concerns is brought into view.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  });

  // ── Actions ────────────────────────────────────────────────────────────
  const choosePlace = useCallback(
    (id: string, options: { fly?: boolean } = {}) => {
      const target = places.get(id);
      if (!target) return;
      setPlace(id);
      setActive((current) =>
        data.events.find((e) => e.id === current)?.placeId === id
          ? current
          : null,
      );
      if (options.fly !== false && onMap(target))
        map.current?.flyTo(id, inset("card"));
      const first = filtered.find((e) => e.placeId === id);
      pendingScroll.current =
        tab === "places"
          ? placeItemId(target.slug)
          : first
            ? eventId(first.slug)
            : null;
    },
    [places, data.events, filtered, tab],
  );

  const openEvent = useCallback(
    (event: TimelineEvent, options: { toggle?: boolean } = {}) => {
      const closing = options.toggle !== false && active === event.id;
      setActive(closing ? null : event.id);
      if (closing) return;
      setTab("timeline");
      pendingScroll.current = eventId(event.slug);
      if (event.placeId) {
        setPlace(event.placeId);
        if (onMap(places.get(event.placeId)))
          map.current?.flyTo(event.placeId, inset("card"));
      }
    },
    [active, places],
  );

  const step = useCallback(
    (index: number) => {
      const event = sequence[index];
      if (!event) {
        setReading(null);
        map.current?.fit();
        return;
      }
      setReading({ index, playing: true });
      setActive(event.id);
      setPlace(event.placeId);
      setTab("timeline");
      pendingScroll.current = eventId(event.slug);
      if (event.placeId) map.current?.flyTo(event.placeId, inset("reading"));
    },
    [sequence],
  );

  useEffect(() => {
    if (!reading?.playing) return;
    const timer = window.setTimeout(() => step(reading.index + 1), DWELL);
    return () => window.clearTimeout(timer);
  }, [reading, step]);

  const stopReading = useCallback(() => setReading(null), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (reading) setReading(null);
      else if (place) setPlace(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reading, place]);

  function mapControl(key: "zoomIn" | "zoomOut" | "fitAll") {
    if (key === "fitAll") map.current?.fit();
    else map.current?.zoomBy(key === "zoomIn" ? 1 : -1);
  }

  function changeFilters(next: TimelineFilters) {
    setReading(null);
    setFilters(next);
  }

  const onReady = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("lieu");
    const eventSlug = params.get("evenement");
    const fromEvent = data.events.find((e) => e.slug === eventSlug)?.placeId;
    const target =
      data.places.find((p) => p.slug === slug)?.id ?? fromEvent ?? null;
    if (target && onMap(places.get(target)))
      map.current?.flyTo(target, inset("card"));
    else map.current?.fit();
  }, [data.events, data.places, places]);

  // ── Rendering ──────────────────────────────────────────────────────────
  const empty = !data.places.length && !data.events.length;
  const centuries = centuriesOf(data.events);
  const kinds = kindsOf(data.events);
  const current = reading ? sequence[reading.index] : null;
  const currentDate = current ? dateParts(current, locale) : null;
  const shownPlaces = visitableOnly
    ? data.places.filter((p) => p.visitable)
    : data.places;
  const eventCount = (id: string) =>
    data.events.filter((e) => e.placeId === id).length;

  return (
    <div
      ref={shell}
      className="flex h-[calc(100svh-var(--header-h))] min-h-[36rem] flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_27rem]"
      style={
        offset !== null ? { height: `calc(100svh - ${offset}px)` } : undefined
      }
    >
      <div className="relative h-[46%] min-h-60 shrink-0 lg:h-auto">
        <MapView
          className="absolute inset-0"
          points={points}
          active={place}
          dimmed={dimmed}
          onSelect={(id) => {
            setReading(null);
            choosePlace(id, { fly: true });
          }}
          onReady={onReady}
          apiRef={map}
          labels={{
            map: t("map"),
            loading: t("mapLoading"),
            unavailable: t("mapUnavailable"),
            credit: t("mapCredit"),
          }}
        />

        <div className="absolute top-3 right-3 z-10 grid gap-2">
          {(
            [
              ["zoomIn", "M8 3v10M3 8h10"],
              ["zoomOut", "M3 8h10"],
              [
                "fitAll",
                "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
              ],
            ] as const
          ).map(([key, path]) => (
            <button
              key={key}
              type="button"
              onClick={() => mapControl(key)}
              aria-label={t(key)}
              title={t(key)}
              className={cn(
                "grid size-11 place-items-center rounded-full border border-hairline-strong bg-paper text-ink shadow-sm",
                "transition-[transform,border-color] duration-(--duration-fast) ease-out hover:border-ink active:scale-[0.96]",
                key !== "fitAll" && "max-lg:hidden",
              )}
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
                <path d={path} />
              </svg>
            </button>
          ))}
        </div>

        {reading && current && (
          <div
            role="region"
            aria-label={t("reading.label")}
            className="absolute top-3 left-3 z-10 grid max-w-[min(24rem,calc(100%-5rem))] gap-1 rounded-xs border border-hairline bg-paper/95 px-3 py-2 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-sm md:gap-2 md:p-4"
          >
            <p aria-live="polite" className="grid gap-1">
              <span className="font-display text-title-sm text-croy-text tabular-nums md:text-title">
                {currentDate?.qualifier && (
                  <span className="mr-2 font-sans text-caption text-ink-muted">
                    {currentDate.qualifier}
                  </span>
                )}
                {currentDate?.year}
              </span>
              <span className="font-medium" lang={current.title.lang}>
                {current.title.text}
              </span>
              {current.placeId && (
                <span className="text-caption text-ink-muted">
                  {places.get(current.placeId)?.name.text}
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                className="link min-h-11 text-caption font-medium"
                onClick={() =>
                  setReading((r) => r && { ...r, playing: !r.playing })
                }
              >
                {reading.playing ? t("reading.pause") : t("reading.resume")}
              </button>
              <button
                type="button"
                className="link min-h-11 text-caption text-ink-muted"
                onClick={stopReading}
              >
                {t("reading.stop")}
              </button>
              <span className="text-caption text-ink-muted tabular-nums">
                {t("reading.progress", {
                  current: reading.index + 1,
                  total: sequence.length,
                })}
              </span>
            </div>
            <span
              aria-hidden="true"
              className="h-0.5 overflow-hidden rounded-full bg-hairline"
            >
              <span
                className="block h-full bg-croy transition-[width] duration-(--duration-base)"
                style={{
                  width: `${((reading.index + 1) / sequence.length) * 100}%`,
                }}
              />
            </span>
          </div>
        )}

        {chosen && !reading && (
          <PlaceCard
            place={chosen}
            events={chosenEvents}
            activeEvent={active}
            onEvent={(e) => openEvent(e, { toggle: false })}
            onClose={() => setPlace(null)}
            className="absolute right-3 bottom-6 left-3 z-10 max-h-[calc(100%-4.5rem)] lg:right-auto lg:bottom-8 lg:max-h-[calc(100%-5rem)] lg:w-[24rem]"
          />
        )}
      </div>

      <aside
        aria-label={t("title")}
        className="flex min-h-0 flex-1 flex-col border-t border-hairline lg:border-t-0 lg:border-l"
      >
        <div className="grid gap-3 px-(--gutter) pt-4 pb-3 lg:px-6 lg:pt-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display text-title-sm lg:text-title">
              {t("title")}
            </h1>
            {!empty && (
              <Button
                size="sm"
                variant={reading ? "primary" : "secondary"}
                disabled={!sequence.length}
                title={sequence.length ? undefined : t("reading.none")}
                onClick={() => (reading ? stopReading() : step(0))}
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="size-3.5"
                  fill="currentColor"
                >
                  {reading ? (
                    <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
                  ) : (
                    <path d="M4.5 2.8v10.4L13 8z" />
                  )}
                </svg>
                {reading ? t("reading.stop") : t("reading.start")}
              </Button>
            )}
          </div>
          <p className="hidden text-ink-muted lg:block">{t("intro")}</p>
          {!empty && (
            <div
              role="tablist"
              aria-label={t("tabs.label")}
              className="flex gap-6 border-b border-hairline"
            >
              {(["timeline", "places"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`onglet-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`panneau-${key}`}
                  onClick={() => setTab(key)}
                  className={cn(
                    "-mb-px min-h-11 border-b-2 font-medium transition-colors duration-(--duration-fast)",
                    tab === key
                      ? "border-croy text-ink"
                      : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {t(`tabs.${key}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--gutter) pb-10 lg:px-6">
          {empty ? (
            <EmptyState
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={emptyAction}
              className="py-10 md:py-12"
            />
          ) : tab === "timeline" ? (
            <div
              role="tabpanel"
              id="panneau-timeline"
              aria-labelledby="onglet-timeline"
              className="grid gap-4"
            >
              <div
                role="group"
                aria-label={t("filters.label")}
                className="grid gap-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid min-w-0 gap-1 text-caption font-medium">
                    {t("filters.century")}
                    <select
                      value={filters.century ?? ""}
                      onChange={(e) =>
                        changeFilters({
                          ...filters,
                          century: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="min-h-11 w-full min-w-0 rounded-xs border border-hairline-strong bg-paper px-3 text-body font-normal"
                    >
                      <option value="">{t("filters.allCenturies")}</option>
                      {centuries.map((c) => (
                        <option key={c} value={c}>
                          {centuryLabel(c, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {data.branches.length > 0 && (
                    <label className="grid min-w-0 gap-1 text-caption font-medium">
                      {t("filters.branch")}
                      <select
                        value={filters.branch ?? ""}
                        onChange={(e) =>
                          changeFilters({
                            ...filters,
                            branch: e.target.value || null,
                          })
                        }
                        className="min-h-11 w-full min-w-0 rounded-xs border border-hairline-strong bg-paper px-3 text-body font-normal"
                      >
                        <option value="">{t("filters.allBranches")}</option>
                        {data.branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {kinds.length > 1 && (
                  <div
                    role="group"
                    aria-label={t("filters.kind")}
                    className="-mx-(--gutter) flex [scrollbar-width:none] gap-2 overflow-x-auto px-(--gutter) lg:mx-0 lg:flex-wrap lg:px-0"
                  >
                    {kinds.map((kind) => {
                      const on = filters.kinds.includes(kind);
                      return (
                        <FilterChip
                          key={kind}
                          pressed={on}
                          className="shrink-0"
                          onClick={() =>
                            changeFilters({
                              ...filters,
                              kinds: on
                                ? filters.kinds.filter((k) => k !== kind)
                                : [...filters.kinds, kind as EventKind],
                            })
                          }
                        >
                          {t(`kinds.${kind}`)}
                        </FilterChip>
                      );
                    })}
                  </div>
                )}
                <p className="flex items-center justify-between gap-4 text-caption text-ink-muted">
                  <span aria-live="polite">
                    {t("filters.count", { count: filtered.length })}
                  </span>
                  {filtering && (
                    <button
                      type="button"
                      className="link min-h-11 font-medium text-ink"
                      onClick={() => changeFilters(NO_TIMELINE_FILTERS)}
                    >
                      {t("filters.reset")}
                    </button>
                  )}
                </p>
              </div>
              {filtered.length ? (
                <Timeline
                  events={filtered}
                  places={places}
                  active={active}
                  highlighted={place}
                  locale={locale}
                  onOpen={(e) => {
                    setReading(null);
                    openEvent(e);
                  }}
                />
              ) : (
                <p className="py-6 text-ink-muted">{t("filters.none")}</p>
              )}
            </div>
          ) : (
            <div
              role="tabpanel"
              id="panneau-places"
              aria-labelledby="onglet-places"
              className="grid gap-3"
            >
              {data.places.some((p) => p.visitable) && (
                <label className="flex min-h-11 items-center gap-3 text-caption font-medium">
                  <input
                    type="checkbox"
                    checked={visitableOnly}
                    onChange={(e) => setVisitableOnly(e.target.checked)}
                    className="size-5 accent-croy"
                  />
                  {t("visitableOnly")}
                </label>
              )}
              {shownPlaces.length ? (
                <ul className="grid border-t border-hairline">
                  {shownPlaces.map((p: MapPlace) => {
                    const count = eventCount(p.id);
                    const label = period(p);
                    return (
                      <li
                        key={p.id}
                        id={placeItemId(p.slug)}
                        className="flex items-center gap-2 border-b border-hairline"
                      >
                        <button
                          type="button"
                          aria-pressed={place === p.id}
                          onClick={() => choosePlace(p.id)}
                          className={cn(
                            "grid min-h-14 min-w-0 flex-1 gap-0.5 py-3 pr-2 text-left",
                            "transition-colors duration-(--duration-fast) hover:text-croy-text",
                          )}
                        >
                          <span
                            className="flex items-center gap-2 font-medium"
                            lang={p.name.lang}
                          >
                            {place === p.id && <Tremas />}
                            {p.name.text}
                          </span>
                          <span className="text-caption text-ink-muted">
                            {[
                              t(`placeKinds.${p.kind}`),
                              label,
                              count ? t("eventsHere", { count }) : null,
                              onMap(p) ? null : t("noCoordinates"),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {p.visitable && (
                            <span className="text-caption font-medium text-croy-text">
                              {t("visitable")}
                            </span>
                          )}
                        </button>
                        <Link
                          href={{
                            pathname: "/lieux/[lieu]",
                            params: { lieu: p.slug },
                          }}
                          aria-label={t("placeLinkNamed", {
                            name: p.name.text,
                          })}
                          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-paper-2 hover:text-ink"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 3.5L10.5 8 6 12.5" />
                          </svg>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-ink-muted">{t("noPlaces")}</p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
