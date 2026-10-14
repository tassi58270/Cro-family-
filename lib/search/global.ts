import { matchScore } from "./normalize";

/**
 * The global search (section 5): the six kinds of content at once, grouped
 * by kind, accents and spelling variants ignored.
 */

export const SEARCH_KINDS = [
  "person",
  "story",
  "place",
  "event",
  "branch",
  "title",
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchEntry = {
  kind: SearchKind;
  /** The page it leads to: for a title, its branch or its first bearer. */
  slug: string;
  via?: "branch" | "person";
  name: string;
  detail: string;
  /** Searched, not shown: titles held, years. */
  words: string;
  anecdote?: boolean;
};

export type SearchGroup = {
  kind: SearchKind;
  total: number;
  entries: SearchEntry[];
};

/**
 * Entries matching every word of the query, best first, grouped by kind in
 * a fixed order. A match on the name ranks before a match on the details.
 */
export function searchAll(
  entries: SearchEntry[],
  query: string,
  perGroup = 8,
): SearchGroup[] {
  if (!query.trim()) return [];
  const scored = entries
    .map((entry, order) => {
      const name = matchScore(entry.name, query);
      const all = name
        ? 0
        : matchScore(`${entry.name} ${entry.detail} ${entry.words}`, query);
      return { entry, order, score: name ? 100 + name : all };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  return SEARCH_KINDS.map((kind) => {
    const found = scored.filter((s) => s.entry.kind === kind);
    return {
      kind,
      total: found.length,
      entries: found.slice(0, perGroup).map((s) => s.entry),
    };
  }).filter((g) => g.total > 0);
}

/** The best few, whatever their kind: the suggestions shown while typing. */
export function suggest(entries: SearchEntry[], query: string, count = 6) {
  return searchAll(entries, query, count)
    .flatMap((g) => g.entries)
    .map((entry) => ({
      entry,
      score: matchScore(entry.name, query),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.entry);
}

/**
 * The parts of `text` that the words of the query match, as [start, end)
 * ranges of the original string, for highlighting. Accents and case are
 * ignored; a spelling variant (Crouy for Croÿ) matches without a highlight.
 */
export function highlightRanges(
  text: string,
  query: string,
): [number, number][] {
  // Each character folded on its own, keeping track of where it came from.
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const plain = text[i]
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[æ]/, "ae")
      .replace(/[œ]/, "oe")
      .replace(/[ß]/, "ss");
    for (const c of plain) {
      folded += /[a-z0-9]/.test(c) ? c : " ";
      origin.push(i);
    }
  }
  const words = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const ranges: [number, number][] = [];
  for (const word of words) {
    let at = folded.indexOf(word);
    while (at > 0 && folded[at - 1] !== " ") at = folded.indexOf(word, at + 1);
    if (at < 0) continue;
    ranges.push([origin[at], origin[at + word.length - 1] + 1]);
  }
  return ranges
    .sort((a, b) => a[0] - b[0])
    .filter((r, i, all) => i === 0 || r[0] >= all[i - 1][1]);
}
