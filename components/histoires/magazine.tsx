"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FilterChip } from "@/components/ui/chip";
import {
  THEMES_LIST,
  type StoryCard as Story,
  type Theme,
} from "@/lib/data/story-types";
import { cn } from "@/lib/design/cn";
import { centuryLabel } from "@/lib/genealogie/tree-model";
import { StoryCard } from "./story-card";

/**
 * The stories as a magazine (6.4): the featured story large, then cards of
 * varied sizes, with filters by person, branch, era, theme and language of
 * origin. Members also see the stories about living relatives.
 */

// Sizes repeat in this rhythm on large screens (six columns).
const RHYTHM: { size: "large" | "medium" | "small"; span: string }[] = [
  { size: "large", span: "lg:col-span-4 md:col-span-2" },
  { size: "small", span: "lg:col-span-2" },
  { size: "medium", span: "lg:col-span-3" },
  { size: "medium", span: "lg:col-span-3" },
  { size: "small", span: "lg:col-span-2" },
  { size: "small", span: "lg:col-span-2" },
  { size: "small", span: "lg:col-span-2" },
];

type Filters = {
  person: string;
  branch: string;
  century: string;
  theme: Theme | "";
  language: string;
};
const NONE: Filters = {
  person: "",
  branch: "",
  century: "",
  theme: "",
  language: "",
};

function century(story: Story) {
  const year = story.eraStart ?? story.eraEnd;
  return year ? Math.floor((year - 1) / 100) + 1 : null;
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-caption">
      <span className="font-medium text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-full border border-hairline-strong bg-paper px-4 text-body text-ink hover:border-ink focus:border-ink focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export function Magazine({
  stories: initial,
  locale,
}: {
  stories: Story[];
  locale: string;
}) {
  const t = useTranslations("stories");
  const tLang = useTranslations("common.languages");
  const [stories, setStories] = useState(initial);
  const [filters, setFilters] = useState<Filters>(NONE);

  useEffect(() => {
    // Members also read the stories about living relatives.
    if (!document.cookie.split("; ").some((c) => c.startsWith("croy_membre=")))
      return;
    fetch(`/api/histoires/${locale}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Story[]>) : null))
      .then((list) => list && setStories(list))
      .catch(() => {});
  }, [locale]);

  const options = useMemo(() => {
    const people = new Map<string, string>();
    const branches = new Map<string, string>();
    for (const s of stories) {
      for (const p of s.people) {
        people.set(p.slug, p.name);
        if (p.branch && p.branchName) branches.set(p.branch, p.branchName);
      }
    }
    const collator = new Intl.Collator(locale);
    return {
      people: [...people].sort((a, b) => collator.compare(a[1], b[1])),
      branches: [...branches].sort((a, b) => collator.compare(a[1], b[1])),
      centuries: [
        ...new Set(stories.map(century).filter((c): c is number => c !== null)),
      ].sort((a, b) => a - b),
      themes: THEMES_LIST.filter((th) =>
        stories.some((s) => s.themes.includes(th)),
      ),
      languages: [...new Set(stories.map((s) => s.originalLocale))],
    };
  }, [stories, locale]);

  const shown = stories.filter(
    (s) =>
      (!filters.person || s.people.some((p) => p.slug === filters.person)) &&
      (!filters.branch || s.people.some((p) => p.branch === filters.branch)) &&
      (!filters.century || century(s) === Number(filters.century)) &&
      (!filters.theme || s.themes.includes(filters.theme)) &&
      (!filters.language || s.originalLocale === filters.language),
  );
  const filtering = Object.values(filters).some(Boolean);
  const featured = !filtering
    ? (shown.find((s) => s.featured) ?? shown[0])
    : undefined;
  const rest = shown.filter((s) => s !== featured);
  const set = (key: keyof Filters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="grid gap-16 md:gap-24">
      {featured && (
        <StoryCard story={featured} size="featured" headingLevel="h2" />
      )}

      <section aria-labelledby="toutes" className="grid gap-10">
        <div className="grid gap-6 border-t border-hairline pt-10">
          <h2 id="toutes" className="font-display text-title">
            {t("all")}
          </h2>
          {stories.length > 2 && (
            <div className="grid gap-4">
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t("filters.theme")}
              >
                <FilterChip
                  pressed={!filters.theme}
                  onClick={() => set("theme")("")}
                >
                  {t("filters.allThemes")}
                </FilterChip>
                {options.themes.map((th) => (
                  <FilterChip
                    key={th}
                    pressed={filters.theme === th}
                    onClick={() => set("theme")(filters.theme === th ? "" : th)}
                  >
                    {t(`themes.${th}`)}
                  </FilterChip>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {options.people.length > 1 && (
                  <Select
                    label={t("filters.person")}
                    value={filters.person}
                    onChange={set("person")}
                  >
                    <option value="">{t("filters.anyone")}</option>
                    {options.people.map(([slug, name]) => (
                      <option key={slug} value={slug}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
                {options.branches.length > 1 && (
                  <Select
                    label={t("filters.branch")}
                    value={filters.branch}
                    onChange={set("branch")}
                  >
                    <option value="">{t("filters.any")}</option>
                    {options.branches.map(([slug, name]) => (
                      <option key={slug} value={slug}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
                {options.centuries.length > 1 && (
                  <Select
                    label={t("filters.era")}
                    value={filters.century}
                    onChange={set("century")}
                  >
                    <option value="">{t("filters.any")}</option>
                    {options.centuries.map((c) => (
                      <option key={c} value={c}>
                        {centuryLabel(c, locale)}
                      </option>
                    ))}
                  </Select>
                )}
                {options.languages.length > 1 && (
                  <Select
                    label={t("filters.language")}
                    value={filters.language}
                    onChange={set("language")}
                  >
                    <option value="">{t("filters.any")}</option>
                    {options.languages.map((l) => (
                      <option key={l} value={l}>
                        {tLang(l)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {filtering && (
                <p
                  role="status"
                  className="flex flex-wrap items-center gap-4 text-caption text-ink-muted"
                >
                  {t("filters.count", { count: shown.length })}
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
          )}
        </div>
        {rest.length ? (
          <div className="grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-6">
            {rest.map((story, i) => {
              const { size, span } = RHYTHM[i % RHYTHM.length];
              return (
                <div key={story.slug} className={cn(span)}>
                  <StoryCard story={story} size={size} />
                </div>
              );
            })}
          </div>
        ) : (
          filtering && <p className="text-ink-muted">{t("filters.none")}</p>
        )}
      </section>
    </div>
  );
}
