"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import type { FaceItem, PhotoIndex } from "@/lib/data/photo-types";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";
import { JustifiedWall } from "./justified-wall";

/**
 * The Photos page (6.5): the wall, the faces of the family, « Qui est-ce ? »
 * and the albums, with entries by person, branch, decade, place, event and
 * album. Members also see the photos of living relatives.
 */

type View = "wall" | "faces" | "who" | "albums";
type Filters = {
  person: string;
  branch: string;
  decade: string;
  place: string;
  event: string;
  album: string;
};
const NONE: Filters = {
  person: "",
  branch: "",
  decade: "",
  place: "",
  event: "",
  album: "",
};

function Select({
  label,
  value,
  onChange,
  options,
  any,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  any: string;
}) {
  if (options.length < 2) return null;
  return (
    <label className="grid gap-1 text-caption">
      <span className="font-medium text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 max-w-[16rem] rounded-full border border-hairline-strong bg-paper px-4 text-body text-ink hover:border-ink focus:border-ink focus:outline-none"
      >
        <option value="">{any}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A face cut out of a photo, using the outline drawn around it. */
export function Face({
  face,
  size,
}: {
  face: Pick<FaceItem, "url" | "box" | "ratio">;
  size: number;
}) {
  if (!face.box) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers.
      <img
        src={`${face.url}?l=320`}
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    );
  }
  const [x, y, w, h] = face.box;
  // A little room around the outline, so that the face is not cut.
  const display = size / (Math.max(w, h / face.ratio, 0.05) * 1.35);
  const height = display / face.ratio;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers.
    <img
      src={`${face.url}?l=${display > 900 ? 2048 : display > 450 ? 1280 : 640}`}
      alt=""
      loading="lazy"
      className="absolute max-w-none"
      style={{
        width: display,
        height,
        left: -x * display + (size - w * display) / 2,
        top: -y * height + (size - h * height) / 2,
      }}
    />
  );
}

export function PhotosApp({
  initial,
  locale,
  action,
}: {
  initial: PhotoIndex;
  locale: string;
  action: ReactNode;
}) {
  const t = useTranslations("photos");
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>("wall");
  const [filters, setFilters] = useState<Filters>(NONE);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("vue");
    const views: Record<string, View> = {
      visages: "faces",
      "qui-est-ce": "who",
      albums: "albums",
    };
    // The view asked for in the address, read once in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (requested && views[requested]) setView(views[requested]);
    if (!document.cookie.split("; ").some((c) => c.startsWith("croy_membre=")))
      return;
    fetch(`/api/photos/${locale}/membres`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PhotoIndex>) : null))
      .then((index) => index && setData(index))
      .catch(() => {});
  }, [locale]);

  function choose(next: View) {
    setView(next);
    const slug = {
      wall: "",
      faces: "visages",
      who: "qui-est-ce",
      albums: "albums",
    }[next];
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("vue", slug);
    else url.searchParams.delete("vue");
    window.history.replaceState(window.history.state, "", url);
  }

  const options = useMemo(() => {
    const collator = new Intl.Collator(locale);
    const sorted = (map: Map<string, string>) =>
      [...map].sort((a, b) => collator.compare(a[1], b[1]));
    const people = new Map<string, string>();
    const places = new Map<string, string>();
    const events = new Map<string, string>();
    for (const p of data.photos) {
      for (const person of p.people)
        if (person.slug && person.name) people.set(person.slug, person.name);
      if (p.place) places.set(p.place.slug, p.place.name);
      if (p.event) events.set(p.event.slug, p.event.title);
    }
    const decades = [
      ...new Set(
        data.photos.map((p) => (p.year ? Math.floor(p.year / 10) * 10 : null)),
      ),
    ]
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);
    return {
      people: sorted(people),
      places: sorted(places),
      events: sorted(events),
      decades: decades.map(
        (d) => [String(d), t("decade", { decade: d })] as [string, string],
      ),
      branches: data.branches
        .filter((b) =>
          data.photos.some((p) => p.people.some((x) => x.branch === b.slug)),
        )
        .map((b) => [b.slug, b.name] as [string, string]),
      albums: data.albums.map((a) => [a.slug, a.title] as [string, string]),
    };
  }, [data, locale, t]);

  const filtered = data.photos.filter(
    (p) =>
      (!filters.person || p.people.some((x) => x.slug === filters.person)) &&
      (!filters.branch || p.people.some((x) => x.branch === filters.branch)) &&
      (!filters.decade ||
        (p.year !== null &&
          Math.floor(p.year / 10) * 10 === Number(filters.decade))) &&
      (!filters.place || p.place?.slug === filters.place) &&
      (!filters.event || p.event?.slug === filters.event) &&
      (!filters.album || p.album?.slug === filters.album),
  );
  const unidentified = data.photos.filter((p) => p.unidentified);
  const set = (key: keyof Filters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const filtering = Object.values(filters).some(Boolean);

  if (!data.photos.length) {
    return (
      <EmptyState
        className="px-(--gutter)"
        title={t("emptyTitle")}
        body={<p>{t("emptyBody")}</p>}
        action={action}
      />
    );
  }

  const tabs: [View, string, number | null][] = [
    ["wall", t("views.wall"), null],
    ["faces", t("views.faces"), data.faces.length || null],
    ["who", t("views.who"), unidentified.length || null],
    ["albums", t("views.albums"), data.albums.length || null],
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4 px-(--gutter)">
        <div
          role="group"
          aria-label={t("views.label")}
          className="-mx-1 flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto px-1"
        >
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => choose(key)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-caption font-medium transition-colors duration-(--duration-fast)",
                view === key ? "bg-ink text-paper" : "hover:bg-paper-2",
              )}
            >
              {label}
              {count !== null && (
                <span
                  className={cn(
                    "tabular",
                    view === key ? "text-paper/70" : "text-ink-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        {action}
      </div>

      {view === "wall" && (
        <>
          <div className="grid gap-3 px-(--gutter)">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Select
                label={t("filters.person")}
                value={filters.person}
                onChange={set("person")}
                options={options.people}
                any={t("filters.anyone")}
              />
              <Select
                label={t("filters.branch")}
                value={filters.branch}
                onChange={set("branch")}
                options={options.branches}
                any={t("filters.any")}
              />
              <Select
                label={t("filters.decade")}
                value={filters.decade}
                onChange={set("decade")}
                options={options.decades}
                any={t("filters.any")}
              />
              <Select
                label={t("filters.place")}
                value={filters.place}
                onChange={set("place")}
                options={options.places}
                any={t("filters.any")}
              />
              <Select
                label={t("filters.event")}
                value={filters.event}
                onChange={set("event")}
                options={options.events}
                any={t("filters.any")}
              />
              <Select
                label={t("filters.album")}
                value={filters.album}
                onChange={set("album")}
                options={options.albums}
                any={t("filters.any")}
              />
            </div>
            {filtering && (
              <p
                role="status"
                className="flex flex-wrap items-center gap-4 text-caption text-ink-muted"
              >
                {t("filters.count", { count: filtered.length })}
                <button
                  type="button"
                  className="link font-medium text-ink"
                  onClick={() => setFilters(NONE)}
                >
                  {t("filters.clear")}
                </button>
              </p>
            )}
          </div>
          <div className="px-2 md:px-4">
            {filtered.length ? (
              <JustifiedWall
                key={JSON.stringify(filters)}
                photos={filtered}
                label={t("views.wall")}
              />
            ) : (
              <p className="px-(--gutter) text-ink-muted">
                {t("filters.none")}
              </p>
            )}
          </div>
        </>
      )}

      {view === "faces" &&
        (data.faces.length ? (
          <ul
            className="grid grid-cols-3 gap-x-4 gap-y-8 px-(--gutter) sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
            aria-label={t("views.faces")}
          >
            {data.faces.map((face) => (
              <li key={face.slug}>
                <Link
                  href={{
                    pathname: "/arbre/[personne]",
                    params: { personne: face.slug },
                  }}
                  className="group grid justify-items-center gap-2 text-center"
                >
                  <span className="relative block size-24 overflow-hidden rounded-full bg-paper-2 ring-1 ring-hairline transition-[box-shadow,transform] duration-(--duration-fast) ease-out group-hover:ring-2 group-hover:ring-croy group-active:scale-[0.97]">
                    <Face face={face} size={96} />
                  </span>
                  <span className="text-caption font-medium group-hover:underline">
                    {face.name}
                  </span>
                  {face.years && (
                    <span className="tabular -mt-1.5 text-[0.8125rem] text-ink-muted">
                      {face.years}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-(--gutter) text-ink-muted">{t("noFaces")}</p>
        ))}

      {view === "who" && (
        <div className="grid gap-6">
          <p className="max-w-2xl px-(--gutter) text-lead text-ink-muted">
            {t("whoIntro")}
          </p>
          {unidentified.length ? (
            <div className="px-2 md:px-4">
              <JustifiedWall photos={unidentified} label={t("views.who")} />
            </div>
          ) : (
            <p className="px-(--gutter) text-ink-muted">{t("whoNone")}</p>
          )}
        </div>
      )}

      {view === "albums" &&
        (data.albums.length ? (
          <ul className="grid gap-x-8 gap-y-12 px-(--gutter) sm:grid-cols-2 lg:grid-cols-3">
            {data.albums.map((album) => (
              <li key={album.slug}>
                <Link
                  href={{
                    pathname: "/photos/albums/[album]",
                    params: { album: album.slug },
                  }}
                  className="group grid gap-3"
                >
                  <span className="block aspect-[4/3] overflow-hidden rounded-xs bg-paper-2">
                    {album.cover && (
                      // eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers.
                      <img
                        src={`${album.cover}?l=640`}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-(--duration-slow) ease-out group-hover:scale-[1.03]"
                      />
                    )}
                  </span>
                  <span className="font-display text-title-sm group-hover:underline">
                    {album.title}
                  </span>
                  <span className="-mt-2 text-caption text-ink-muted">
                    {t("albumCount", { count: album.count })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-(--gutter) text-ink-muted">{t("noAlbums")}</p>
        ))}
    </div>
  );
}
