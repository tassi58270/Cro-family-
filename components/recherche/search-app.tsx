"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BandsLoader, Tremas } from "@/components/ui/bands";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import {
  highlightRanges,
  searchAll,
  type SearchEntry,
} from "@/lib/search/global";

const MEMBER_COOKIE = "croy_membre=";

function hrefOf(entry: SearchEntry) {
  switch (entry.kind) {
    case "person":
      return {
        pathname: "/arbre/[personne]" as const,
        params: { personne: entry.slug },
      };
    case "story":
      return {
        pathname: "/histoires/[histoire]" as const,
        params: { histoire: entry.slug },
      };
    case "place":
      return {
        pathname: "/lieux/[lieu]" as const,
        params: { lieu: entry.slug },
      };
    case "event":
      return {
        pathname: "/lieux-et-evenements" as const,
        query: { evenement: entry.slug },
      };
    case "branch":
      return {
        pathname: "/branches/[branche]" as const,
        params: { branche: entry.slug },
      };
    case "title":
      return entry.via === "branch"
        ? {
            pathname: "/branches/[branche]" as const,
            params: { branche: entry.slug },
          }
        : {
            pathname: "/arbre/[personne]" as const,
            params: { personne: entry.slug },
          };
  }
}

/** The words that matched, in bold: the eye finds why each result is there. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let from = 0;
  ranges.forEach(([start, end], i) => {
    if (start > from) parts.push(text.slice(from, start));
    parts.push(
      <mark key={i} className="bg-transparent font-semibold text-ink">
        {text.slice(start, end)}
      </mark>,
    );
    from = end;
  });
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

const BROWSE = [
  ["/arbre", "tree"],
  ["/histoires", "stories"],
  ["/lieux-et-evenements", "places"],
  ["/armoiries", "arms"],
  ["/photos", "photos"],
] as const;

/**
 * The global search (section 5): results appear while typing, grouped by
 * kind. The index arrives once; a member's also holds their living
 * relatives. The query is kept in the address (`q`).
 */
export function SearchApp({ locale }: { locale: string }) {
  const t = useTranslations("searchPage");
  const tNav = useTranslations("nav");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // The query asked for in the address, read once in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setQuery(q);
    input.current?.focus();
    const member = document.cookie
      .split("; ")
      .some((c) => c.startsWith(MEMBER_COOKIE));
    const load = (url: string) =>
      fetch(url, member ? { cache: "no-store" } : undefined).then((r) =>
        r.ok ? (r.json() as Promise<SearchEntry[]>) : Promise.reject(),
      );
    (member
      ? load(`/api/recherche/${locale}/membres`).catch(() =>
          load(`/api/recherche/${locale}`),
        )
      : load(`/api/recherche/${locale}`)
    )
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [locale]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [query]);

  const groups = useMemo(
    () => (entries ? searchAll(entries, query, 1000) : []),
    [entries, query],
  );
  const total = groups.reduce((n, g) => n + g.total, 0);
  const searching = query.trim().length > 0;

  return (
    <div className="grid gap-10">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          input.current?.blur();
        }}
        className="grid gap-3"
      >
        <label htmlFor="recherche" className="font-medium">
          {t("label")}
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-ink-muted"
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
            id="recherche"
            type="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={t("placeholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded(new Set());
            }}
            className="h-14 w-full rounded-full border border-hairline-strong bg-paper pr-5 pl-13 text-lead transition-colors duration-(--duration-fast) placeholder:text-ink-muted hover:border-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-croy md:h-16"
          />
        </div>
        <p
          aria-live="polite"
          className="min-h-6 text-caption text-ink-muted tabular-nums"
        >
          {searching && entries ? t("count", { count: total }) : ""}
        </p>
      </form>

      {!entries && searching && (
        <BandsLoader label={t("loading")} className="text-croy" />
      )}

      {entries && searching && total === 0 && (
        <div className="grid justify-items-start gap-4 border-t border-hairline pt-8">
          <p className="font-display text-title-sm">
            {t("none", { query: query.trim() })}
          </p>
          <p className="max-w-prose text-ink-muted">{t("noneHint")}</p>
          <ButtonLink href="/contribuer" variant="secondary">
            {t("propose")}
          </ButtonLink>
        </div>
      )}

      {groups.map((group) => {
        const open = expanded.has(group.kind);
        const shown = open ? group.entries : group.entries.slice(0, 8);
        const id = `resultats-${group.kind}`;
        return (
          <section key={group.kind} aria-labelledby={id} className="grid gap-3">
            <h2
              id={id}
              className="flex items-baseline gap-3 border-t border-hairline pt-6 font-display text-title-sm"
            >
              {t(`kinds.${group.kind}`)}
              <span className="font-sans text-caption text-ink-muted tabular-nums">
                {group.total}
              </span>
            </h2>
            <ul className="grid">
              {shown.map((entry) => (
                <li key={`${entry.kind}-${entry.slug}-${entry.name}`}>
                  <Link
                    href={hrefOf(entry)}
                    className="group -mx-3 grid min-h-14 content-center gap-0.5 rounded-lg px-3 py-2.5 transition-colors duration-(--duration-fast) hover:bg-paper-2 focus-visible:bg-paper-2"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-ink decoration-croy decoration-2 underline-offset-4 group-hover:underline">
                        <Highlighted text={entry.name} query={query} />
                      </span>
                      {entry.anecdote && (
                        <span className="inline-flex items-center gap-1.5 text-caption text-croy-text">
                          <Tremas />
                          {t("anecdote")}
                        </span>
                      )}
                    </span>
                    {entry.detail && (
                      <span className="line-clamp-2 text-caption text-ink-muted tabular-nums">
                        {entry.detail}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {group.total > shown.length && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((all) => new Set(all).add(group.kind))
                  }
                  className="link inline-flex min-h-11 items-center text-caption font-medium"
                >
                  {t("showAll", { count: group.total })}
                </button>
              </div>
            )}
          </section>
        );
      })}

      {!searching && (
        <nav aria-labelledby="parcourir" className="grid gap-4">
          <h2
            id="parcourir"
            className="border-t border-hairline pt-6 text-caption font-medium text-ink-muted"
          >
            {t("browse")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {BROWSE.map(([href, key]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-4 font-medium transition-colors duration-(--duration-fast) hover:border-ink"
                >
                  {tNav(key)}
                </Link>
              </li>
            ))}
          </ul>
          {entries?.length === 0 && (
            <p className="max-w-prose text-ink-muted">{t("emptySite")}</p>
          )}
        </nav>
      )}
    </div>
  );
}
