"use client";

import { useEffect, useState } from "react";
import type { Anecdote } from "@/lib/data/home";
import { Tremas } from "@/components/ui/bands";
import { Link } from "@/lib/i18n/navigation";

function pickThree(items: Anecdote[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 3);
}

/**
 * « Le saviez-vous ? » (6.1): three anecdotes drawn at random at each visit,
 * on red cards with white text. The page is static, so the draw happens in
 * the browser; the first three are shown until then.
 */
export function Anecdotes({
  id,
  title,
  anecdotes,
  readLabel,
}: {
  id: string;
  title: string;
  anecdotes: Anecdote[];
  readLabel: string;
}) {
  const [shown, setShown] = useState(() => anecdotes.slice(0, 3));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the draw must differ from the static page.
    setShown(pickThree(anecdotes));
  }, [anecdotes]);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="page py-(--section)"
    >
      <div className="mx-auto grid max-w-6xl gap-10">
        <h2
          id={`${id}-titre`}
          className="flex items-center gap-4 font-display text-title-lg"
        >
          <Tremas className="text-[1.25rem]" />
          {title}
        </h2>
        <ul className="grid gap-5 md:grid-cols-3">
          {shown.map((a) => (
            <li
              key={a.id}
              className="group relative flex min-h-64 flex-col gap-4 bg-croy p-7 text-on-croy transition-[background-color,transform] duration-(--duration-base) ease-out hover:bg-croy-deep md:p-8"
            >
              <h3 className="font-display text-title-sm" lang={a.title.lang}>
                {a.title.text}
              </h3>
              {a.excerpt && (
                <p className="line-clamp-5 opacity-95" lang={a.excerpt.lang}>
                  {a.excerpt.text}
                </p>
              )}
              <Link
                href={{
                  pathname: "/histoires/[histoire]",
                  params: { histoire: a.slug },
                }}
                className="mt-auto inline-flex min-h-11 items-center gap-2 font-medium underline decoration-on-croy/50 underline-offset-4 group-hover:decoration-on-croy after:absolute after:inset-0"
              >
                {readLabel}
                <span className="sr-only">: {a.title.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
