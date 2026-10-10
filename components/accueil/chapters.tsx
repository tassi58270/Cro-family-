"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HomeChapter } from "@/lib/data/home";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

/**
 * « L'histoire en quelques chapitres » (6.1): one chapter per screen; on
 * computers the map of Europe stays still on the right and travels from one
 * place to the next; on phones each chapter has its map under its text.
 * Light by design: the map is a static SVG loaded when the section comes
 * near, moved with CSS transforms, and the active chapter comes from an
 * IntersectionObserver.
 */

type MapData = {
  width: number;
  height: number;
  projection: {
    parallels: [number, number];
    rotate: [number, number];
    center: [number, number];
    scale: number;
    translate: [number, number];
  };
  land: string;
  borders: string;
};

type View = {
  tx: number;
  ty: number;
  z: number;
  marker: [number, number] | null;
};

const WHOLE: View = { tx: 0, ty: 0, z: 1, marker: null };

function viewFor(
  chapter: HomeChapter | undefined,
  map: MapData,
  project: ((p: [number, number]) => [number, number] | null) | null,
): View {
  if (!chapter?.point || !project) return WHOLE;
  const xy = project(chapter.point);
  if (!xy) return WHOLE;
  const z = Math.max(1, chapter.zoom);
  const { width: W, height: H } = map;
  // Centre the place, without showing anything beyond the edges of the map.
  const tx = Math.min(0, Math.max(W - W * z, W / 2 - xy[0] * z));
  const ty = Math.min(0, Math.max(H - H * z, H / 2 - xy[1] * z));
  return { tx, ty, z, marker: [xy[0] * z + tx, xy[1] * z + ty] };
}

function MapView({
  map,
  view,
  trail,
  className,
}: {
  map: MapData | null;
  view: View;
  trail: [number, number][];
  className?: string;
}) {
  const W = map?.width ?? 1000;
  const H = map?.height ?? 860;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("chapters-map h-full w-full", className)}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g
        className="chapters-map-moving"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`,
        }}
      >
        {map && (
          <>
            <use href="#europe-land" className="chapters-land" />
            <use href="#europe-borders" className="chapters-borders" />
          </>
        )}
      </g>
      {trail.map(([x, y], i) => (
        <circle
          key={i}
          className="chapters-trail"
          r="3.5"
          style={{
            transform: `translate(${x * view.z + view.tx}px, ${y * view.z + view.ty}px)`,
          }}
        />
      ))}
      {view.marker && (
        <g
          className="chapters-marker"
          style={{
            transform: `translate(${view.marker[0]}px, ${view.marker[1]}px)`,
          }}
        >
          <circle cx="-7.5" cy="0" r="6" />
          <circle cx="7.5" cy="0" r="6" />
        </g>
      )}
    </svg>
  );
}

export function Chapters({
  id,
  title,
  chapters,
  treeLinkLabel,
  prologueLabel,
}: {
  id: string;
  title: string;
  chapters: HomeChapter[];
  treeLinkLabel: string;
  prologueLabel: string;
}) {
  const section = useRef<HTMLElement>(null);
  const [map, setMap] = useState<MapData | null>(null);
  const [project, setProject] = useState<
    ((p: [number, number]) => [number, number] | null) | null
  >(null);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());

  // The map and the projection load only when the section comes near.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const [data, d3] = await Promise.all([
          fetch("/carte/europe.json").then((r) => r.json() as Promise<MapData>),
          import("d3-geo"),
        ]);
        if (cancelled) return;
        const p = data.projection;
        const projection = d3
          .geoConicConformal()
          .parallels(p.parallels)
          .rotate(p.rotate)
          .center(p.center)
          .scale(p.scale)
          .translate(p.translate);
        setMap(data);
        setProject(() => (point: [number, number]) => projection(point));
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  // The chapter crossing the middle of the screen is the active one.
  useEffect(() => {
    const items =
      section.current?.querySelectorAll<HTMLElement>("[data-chapter]");
    if (!items) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.chapter);
          setActive(index);
          setSeen((s) => (s.has(index) ? s : new Set(s).add(index)));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const views = useMemo(
    () =>
      map
        ? chapters.map((c) => viewFor(c, map, project))
        : chapters.map(() => WHOLE),
    [chapters, map, project],
  );
  const points = useMemo(
    () => chapters.map((c) => (c.point && project ? project(c.point) : null)),
    [chapters, project],
  );
  const trail = (upTo: number) =>
    points.slice(0, upTo).filter((p): p is [number, number] => Boolean(p));
  const progress = chapters.length ? (active + 1) / chapters.length : 0;

  return (
    <section
      ref={section}
      id={id}
      aria-labelledby={`${id}-titre`}
      className="chapters relative border-t border-hairline"
    >
      <h2 id={`${id}-titre`} className="sr-only">
        {title}
      </h2>

      {map && (
        <svg className="absolute size-0" aria-hidden="true" focusable="false">
          <defs>
            <path
              id="europe-land"
              d={map.land}
              vectorEffect="non-scaling-stroke"
            />
            <path
              id="europe-borders"
              d={map.borders}
              vectorEffect="non-scaling-stroke"
            />
          </defs>
        </svg>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ol className="page">
          {chapters.map((chapter, i) => (
            <li
              key={chapter.id}
              data-chapter={i}
              className="flex min-h-[calc(100svh-var(--header-h))] flex-col justify-center gap-8 py-16 lg:py-24"
            >
              <div
                className={cn(
                  "chapter-text grid max-w-xl gap-5",
                  seen.has(i) && "is-seen",
                )}
              >
                {(chapter.dateLabel || chapter.prologue) && (
                  <p
                    className="tabular font-display text-display leading-none text-croy-text"
                    lang={chapter.dateLabel?.lang}
                  >
                    {chapter.dateLabel?.text ?? prologueLabel}
                  </p>
                )}
                <h3
                  className="font-display text-title"
                  lang={chapter.title.lang}
                >
                  {chapter.title.text}
                </h3>
                {chapter.body && (
                  <p
                    className="text-lead text-ink-muted"
                    lang={chapter.body.lang}
                  >
                    {chapter.body.text}
                  </p>
                )}
                {chapter.eraStart != null && (
                  <p>
                    <Link
                      href={{
                        pathname: "/arbre",
                        query: { annee: String(chapter.eraStart) },
                      }}
                      className="link font-medium"
                    >
                      {treeLinkLabel}
                    </Link>
                  </p>
                )}
              </div>
              <div className="relative -mx-(--gutter) aspect-[5/4] overflow-hidden bg-paper lg:hidden">
                <MapView
                  map={map}
                  view={seen.has(i) ? views[i] : (views[i - 1] ?? WHOLE)}
                  trail={trail(i)}
                />
              </div>
            </li>
          ))}
        </ol>

        <div className="sticky top-(--header-h) hidden h-[calc(100svh-var(--header-h))] overflow-hidden border-l border-hairline lg:block">
          <MapView
            map={map}
            view={views[active] ?? WHOLE}
            trail={trail(active)}
          />
          <div
            className="absolute inset-x-8 top-8 grid gap-[3px]"
            role="progressbar"
            aria-label={title}
            aria-valuemin={1}
            aria-valuemax={chapters.length}
            aria-valuenow={active + 1}
          >
            {[0, 1, 2].map((band) => (
              <span key={band} className="block h-[2px] bg-hairline">
                <span
                  className="block h-full origin-left bg-croy transition-transform duration-(--duration-slow) ease-in-out"
                  style={{
                    transform: `scaleX(${progress})`,
                    transitionDelay: `${band * 50}ms`,
                  }}
                />
              </span>
            ))}
          </div>
          {chapters[active]?.placeName && (
            <p className="absolute bottom-8 left-8 text-caption font-medium text-ink-muted">
              {chapters[active].placeName}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
