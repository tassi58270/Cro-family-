"use client";

import { useEffect, useRef } from "react";
import type { HomeFigure } from "@/lib/data/home";

/**
 * « En chiffres »: large numbers that count up once, when they come into
 * view (6.1). The final number is in the page from the start, for readers
 * without JavaScript or with reduced motion.
 */
export function Figures({
  id,
  title,
  figures,
  locale,
}: {
  id: string;
  title: string;
  figures: HomeFigure[];
  locale: string;
}) {
  const list = useRef<HTMLDListElement>(null);

  useEffect(() => {
    const root = list.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const format = new Intl.NumberFormat(locale);
    const numbers = [...root.querySelectorAll<HTMLElement>("[data-value]")];
    const frames = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const el = entry.target as HTMLElement;
          const target = Number(el.dataset.value);
          const index = numbers.indexOf(el);
          const duration = 900 + Math.min(500, target * 3);
          const start = performance.now() + index * 90;
          const tick = (now: number) => {
            const t = Math.min(1, Math.max(0, (now - start) / duration));
            // Strong ease-out: fast at first, settling on the number.
            const eased = 1 - Math.pow(1 - t, 4);
            el.textContent = format.format(Math.round(target * eased));
            if (t < 1) frames.add(requestAnimationFrame(tick));
          };
          el.textContent = format.format(0);
          frames.add(requestAnimationFrame(tick));
        }
      },
      { threshold: 0.6 },
    );
    numbers.forEach((n) => observer.observe(n));
    return () => {
      observer.disconnect();
      frames.forEach(cancelAnimationFrame);
      numbers.forEach(
        (n) => (n.textContent = format.format(Number(n.dataset.value))),
      );
    };
  }, [locale]);

  const format = new Intl.NumberFormat(locale);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="page py-(--section)"
    >
      <div className="mx-auto grid max-w-6xl gap-10">
        <h2
          id={`${id}-titre`}
          className="text-caption font-medium text-ink-muted"
        >
          {title}
        </h2>
        <dl
          ref={list}
          className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5"
        >
          {figures.map((figure) => (
            <div
              key={figure.id}
              className="grid content-start gap-3 border-t-2 border-croy pt-5"
            >
              <dt
                className="order-2 max-w-[16ch] text-ink-muted"
                lang={figure.label.lang}
              >
                {figure.label.text}
              </dt>
              <dd className="tabular order-1 font-display text-display leading-none">
                <span data-value={figure.value}>
                  {format.format(figure.value)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
