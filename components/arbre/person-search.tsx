"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { TreeData } from "@/lib/data/tree";
import { cn } from "@/lib/design/cn";
import {
  personLabel,
  personYears,
  searchPeople,
  type TreeModel,
} from "@/lib/genealogie/tree-model";

/**
 * A search field with suggestions while typing (combobox pattern): by name,
 * first name, title, place or year. Choosing a suggestion hands the person
 * over; Enter takes the first one.
 */
export function PersonSearch({
  data,
  model,
  locale,
  label,
  placeholder,
  onPick,
  value,
  className,
  autoFocus,
  size = "large",
}: {
  data: TreeData;
  model: TreeModel;
  locale: string;
  label: string;
  placeholder?: string;
  onPick: (person: number) => void;
  /** The person shown in the field once chosen (link pickers). */
  value?: number | null;
  className?: string;
  autoFocus?: boolean;
  size?: "large" | "small";
}) {
  const t = useTranslations("tree.search");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(
    value != null && value >= 0 ? personLabel(data.people[value]) : "",
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(
    () => searchPeople(data, model, query),
    [data, model, query],
  );
  const showList = open && query.trim().length > 0;

  function pick(person: number) {
    setOpen(false);
    setQuery(value !== undefined ? personLabel(data.people[person]) : "");
    onPick(person);
    if (value === undefined) input.current?.blur();
  }

  function describe(person: number) {
    const p = data.people[person];
    const extra = [
      p.titles.length ? data.titles[p.titles[0]]?.name : null,
      p.branch >= 0 ? data.branches[p.branch]?.name : null,
    ].filter(Boolean);
    return [personYears(p, locale), ...extra].filter(Boolean).join(" · ");
  }

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-muted",
            size === "large" ? "left-4 size-5" : "left-3 size-4",
          )}
        >
          <circle
            cx="8.5"
            cy="8.5"
            r="5.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="m13 13 4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={input}
          id={`${id}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && hits[active] ? `${id}-option-${active}` : undefined
          }
          placeholder={placeholder ?? t("placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (event.key === "Enter") {
              const hit = hits[active] ?? hits[0];
              if (hit) {
                event.preventDefault();
                pick(hit.person);
              }
            } else if (event.key === "Escape" && showList) {
              event.preventDefault();
              setOpen(false);
            }
          }}
          className={cn(
            "w-full rounded-full border border-hairline-strong bg-paper text-ink placeholder:text-ink-muted",
            "transition-[border-color,box-shadow] duration-(--duration-fast) ease-out",
            "focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-croy/40",
            "[&::-webkit-search-cancel-button]:hidden",
            size === "large"
              ? "h-12 pr-4 pl-12 text-body"
              : "h-11 pr-3 pl-9 text-caption",
          )}
        />
      </div>
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        hidden={!showList}
        className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(24rem,60svh)] overflow-y-auto rounded-sm border border-hairline bg-paper py-1.5 shadow-(--shadow-panel)"
      >
        {hits.length === 0 ? (
          <p className="px-4 py-3 text-caption text-ink-muted">
            {t("noResult")}
          </p>
        ) : (
          hits.map((hit, i) => (
            <div
              key={hit.person}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(hit.person)}
              onMouseMove={() => setActive(i)}
              className={cn(
                "grid min-h-12 cursor-pointer content-center gap-0.5 px-4 py-2",
                i === active && "bg-paper-2",
              )}
            >
              <span className="font-medium">
                {personLabel(data.people[hit.person])}
              </span>
              <span className="tabular text-caption text-ink-muted">
                {describe(hit.person)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
