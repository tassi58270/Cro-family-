"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { TitleCard } from "@/lib/data/home";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

/**
 * « Les titres » (6.1): a horizontal frieze of cards to slide through.
 * Each card shows the title, its year, who created it and the branch; a
 * click turns it over to list the successive holders, with links to the tree.
 */
export function TitlesFrieze({
  id,
  title,
  titles,
  labels,
}: {
  id: string;
  title: string;
  titles: TitleCard[];
  labels: {
    createdBy: string;
    holders: string;
    noHolder: string;
    turn: string;
    back: string;
    previous: string;
    next: string;
  };
}) {
  const track = useRef<HTMLUListElement>(null);
  const [flipped, setFlipped] = useState<string | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const scrollBy = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // Mice drag the frieze like a finger would; touch keeps native scrolling.
  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = {
      x: e.clientX,
      left: e.currentTarget.scrollLeft,
      moved: false,
    };
  };
  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4 && !d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "true";
    }
    if (d.moved) e.currentTarget.scrollLeft = d.left - dx;
  };
  const onPointerUp = (e: PointerEvent<HTMLUListElement>) => {
    const moved = drag.current?.moved;
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
    if (moved) {
      // The click that ends a drag must not turn a card.
      const stop = (event: Event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      e.currentTarget.addEventListener("click", stop, {
        capture: true,
        once: true,
      });
      setTimeout(
        () =>
          e.currentTarget?.removeEventListener("click", stop, {
            capture: true,
          }),
        0,
      );
    }
  };

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="border-t border-hairline py-(--section)"
    >
      <div className="page">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6">
          <h2 id={`${id}-titre`} className="font-display text-title-lg">
            {title}
          </h2>
          <div className="hidden gap-2 sm:flex">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => scrollBy(direction)}
                className="grid size-12 place-items-center rounded-full border border-hairline-strong transition-[border-color,transform] duration-(--duration-fast) hover:border-ink active:scale-[0.94]"
              >
                <span className="sr-only">
                  {direction < 0 ? labels.previous : labels.next}
                </span>
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
                  <path
                    d={direction < 0 ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul
        ref={track}
        className="titles-track mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain px-(--gutter) pb-6 lg:px-[max(var(--gutter),calc((100vw-72rem)/2))]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {titles.map((t) => {
          const isFlipped = flipped === t.id;
          return (
            <li
              key={t.id}
              className="title-card w-[min(19rem,78vw)] shrink-0 snap-start"
            >
              <div
                className={cn("title-card-inner", isFlipped && "is-flipped")}
              >
                <div className="title-face" aria-hidden={isFlipped}>
                  <span aria-hidden="true" className="grid w-10 gap-[4px]">
                    <i className="h-[3px] bg-croy" />
                    <i className="h-[3px] bg-croy" />
                    <i className="h-[3px] bg-croy" />
                  </span>
                  <p className="tabular mt-auto font-display text-[clamp(3rem,2.2rem+2.4vw,4.5rem)] leading-none">
                    {t.year ?? "—"}
                  </p>
                  <h3 className="font-display text-title-sm" lang={t.name.lang}>
                    {t.name.text}
                  </h3>
                  <p className="text-caption text-ink-muted">
                    {[t.creator && `${labels.createdBy} ${t.creator}`, t.branch]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setFlipped(t.id)}
                    className="mt-2 inline-flex min-h-11 items-center gap-2 self-start text-caption font-medium after:absolute after:inset-0"
                    aria-expanded={isFlipped}
                    tabIndex={isFlipped ? -1 : 0}
                  >
                    {labels.turn}
                    <span aria-hidden="true">↻</span>
                  </button>
                </div>
                <div className="title-face title-back" aria-hidden={!isFlipped}>
                  <h4 className="text-caption font-medium text-ink-muted">
                    {labels.holders}
                  </h4>
                  {t.holders.length ? (
                    <ol className="grid gap-2 overflow-y-auto">
                      {t.holders.map((h, i) => (
                        <li key={i} className="flex items-baseline gap-3">
                          <span className="tabular w-6 shrink-0 text-right font-display text-croy-text">
                            {h.rank ?? "·"}
                          </span>
                          <span className="min-w-0">
                            {h.slug ? (
                              <Link
                                href={{
                                  pathname: "/arbre/[personne]",
                                  params: { personne: h.slug },
                                }}
                                className="link relative z-10"
                                tabIndex={isFlipped ? 0 : -1}
                              >
                                {h.name}
                              </Link>
                            ) : (
                              h.name
                            )}
                            {h.years && (
                              <span className="tabular block text-caption text-ink-muted">
                                {h.years}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-ink-muted">{labels.noHolder}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setFlipped(null)}
                    className="mt-auto inline-flex min-h-11 items-center gap-2 self-start text-caption font-medium"
                    tabIndex={isFlipped ? 0 : -1}
                  >
                    <span aria-hidden="true">↺</span>
                    {labels.back}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
