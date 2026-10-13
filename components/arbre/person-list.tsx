"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { TreeData } from "@/lib/data/tree";
import { personLabel, personYears } from "@/lib/genealogie/tree-model";

const PAGE = 60;

/**
 * The tree as a list: the same people, sorted by name or by date, readable
 * with a screen reader and from the keyboard. Filters and the time slider
 * apply here too.
 */
export function PersonList({
  data,
  locale,
  isLit,
  filtering,
  onOpen,
}: {
  data: TreeData;
  locale: string;
  isLit: (person: number) => boolean;
  filtering: boolean;
  onOpen: (person: number) => void;
}) {
  const t = useTranslations("tree.list");
  const [sort, setSort] = useState<"name" | "birth">("name");
  const [shown, setShown] = useState(PAGE);
  const collator = useMemo(
    () => new Intl.Collator(locale, { sensitivity: "base" }),
    [locale],
  );

  const people = useMemo(() => {
    const list = data.people
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !p.hidden && (!filtering || isLit(i)));
    return list.sort((a, b) =>
      sort === "name"
        ? collator.compare(a.p.surname ?? "", b.p.surname ?? "") ||
          collator.compare(a.p.given ?? "", b.p.given ?? "")
        : (a.p.birth ?? 9999) - (b.p.birth ?? 9999),
    );
  }, [data, filtering, isLit, sort, collator]);
  const hidden = data.people.filter((p) => p.hidden).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-3xl gap-4 px-(--gutter) py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-caption text-ink-muted" role="status">
            {t("count", { count: people.length })}
          </p>
          <label className="flex items-center gap-2 text-caption text-ink-muted">
            {t("sort")}
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "name" | "birth")
              }
              className="min-h-10 rounded-full border border-hairline-strong bg-paper px-3 text-ink"
            >
              <option value="name">{t("byName")}</option>
              <option value="birth">{t("byBirth")}</option>
            </select>
          </label>
        </div>
        <ul className="grid border-t border-hairline">
          {people.slice(0, shown).map(({ p, i }) => (
            <li key={p.id} className="border-b border-hairline">
              <button
                type="button"
                onClick={() => onOpen(i)}
                className="group grid min-h-14 w-full grid-cols-[auto_1fr] items-center gap-x-4 py-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className="h-8 w-1 rounded-full"
                  style={{
                    background:
                      p.branch >= 0
                        ? data.branches[p.branch]?.extinct
                          ? "var(--branch-extinct)"
                          : (data.branches[p.branch]?.color ??
                            `var(--branch-${p.branch % 6})`)
                        : "var(--hairline-strong)",
                  }}
                />
                <span className="grid min-w-0">
                  <span className="truncate font-medium decoration-croy decoration-[1.5px] underline-offset-4 group-hover:underline">
                    {personLabel(p)}
                  </span>
                  <span className="tabular truncate text-caption text-ink-muted">
                    {[
                      personYears(p, locale),
                      p.branch >= 0 ? data.branches[p.branch]?.name : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {shown < people.length && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="min-h-11 justify-self-center rounded-full border border-hairline-strong px-5 text-caption font-medium"
          >
            {t("more", { count: Math.min(PAGE, people.length - shown) })}
          </button>
        )}
        {hidden > 0 && (
          <p className="text-caption text-ink-muted">
            {t("living", { count: hidden })}
          </p>
        )}
      </div>
    </div>
  );
}
