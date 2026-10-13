import type { TreeData, TreePerson } from "@/lib/data/tree";
import { buildGraph, type Graph } from "@/lib/genealogie/layout";
import type { FamilyGraph } from "@/lib/genealogie/relationship";
import { matchScore, normalizeForSearch } from "@/lib/search/normalize";

/**
 * What the tree page computes from the compact tree file, apart from the
 * drawing: names, the search, who is alive at a given year, the filters and
 * where the tree opens. People are referred to by their index.
 */

const ABOUT: Record<string, string> = { fr: "v.", en: "c.", de: "um" };

export function personLabel(p: TreePerson): string {
  const name = [p.given, p.surname].filter(Boolean).join(" ").trim();
  if (!p.epithet) return name;
  return name ? `${name}, ${p.epithet}` : p.epithet;
}

function yearText(
  year: number | null,
  precision: TreePerson["birthPrecision"],
  locale: string,
) {
  if (year === null) return null;
  if (precision === "about") return `${ABOUT[locale] ?? ABOUT.fr} ${year}`;
  if (precision === "before") return `< ${year}`;
  if (precision === "after") return `> ${year}`;
  return String(year);
}

/** « 1360 – 1415 », « v. 1360 – 1415 », « 1980 », « ? – 1415 ». */
export function personYears(p: TreePerson, locale: string): string {
  const birth = yearText(p.birth, p.birthPrecision, locale);
  const death = yearText(p.death, p.deathPrecision, locale);
  if (death) return `${birth ?? "?"} – ${death}`;
  if (birth) return p.deceased ? `${birth} – ?` : birth;
  return "";
}

export type TreeModel = {
  graph: Graph;
  family: FamilyGraph;
  /** Normalised text searched for each person. */
  haystacks: string[];
  bySlug: Map<string, number>;
  byId: Map<string, number>;
  /** First year of the time slider. */
  minYear: number;
};

export function buildModel(data: TreeData): TreeModel {
  const graph = buildGraph({
    count: data.people.length,
    links: data.links,
    unions: data.unions,
    birthOf: (i) => data.people[i].birth,
  });
  const key = (i: number) => String(i);
  const family: FamilyGraph = {
    parentsOf: new Map(graph.parents.map((ps, i) => [key(i), ps.map(key)])),
    childrenOf: new Map(graph.children.map((cs, i) => [key(i), cs.map(key)])),
    spousesOf: new Map(
      graph.unions.map((us, i) => [
        key(i),
        us.filter(([, p]) => p >= 0).map(([, p]) => key(p)),
      ]),
    ),
    sexOf: new Map(data.people.map((p, i) => [key(i), p.sex ?? "unknown"])),
  };
  const haystacks = data.people.map((p) =>
    p.hidden
      ? ""
      : normalizeForSearch(
          [
            personLabel(p),
            p.originFamily,
            ...p.titles.map((t) => data.titles[t]?.name),
            ...p.places,
            p.branch >= 0 ? data.branches[p.branch]?.name : null,
          ]
            .filter(Boolean)
            .join(" "),
        ),
  );
  const bySlug = new Map<string, number>();
  data.people.forEach((p, i) => p.slug && bySlug.set(p.slug, i));
  const byId = new Map(data.people.map((p, i) => [p.id, i]));
  const years = data.people
    .map((p) => p.birth ?? p.death)
    .filter((y): y is number => y !== null);
  const minYear = years.length
    ? Math.floor(Math.min(...years) / 50) * 50
    : 1900;
  return { graph, family, haystacks, bySlug, byId, minYear };
}

export type SearchHit = { person: number; score: number };

/**
 * People matching a query: by name, first name, title, place or branch, in
 * any spelling of the family's names, or by a year (« 1415 »: born, died or
 * alive that year). Living people shown as placeholders are never found.
 */
export function searchPeople(
  data: TreeData,
  model: TreeModel,
  query: string,
  limit = 8,
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const yearMatch = /^\d{3,4}$/.exec(q);
  const hits: SearchHit[] = [];
  data.people.forEach((p, i) => {
    if (p.hidden) return;
    let score = 0;
    if (yearMatch) {
      const year = Number(q);
      if (p.birth === year || p.death === year) score = 5;
      else if (
        p.birth !== null &&
        p.birth <= year &&
        (p.death ?? p.birth + 90) >= year
      )
        score = 2;
    } else {
      score = matchScore(model.haystacks[i], q);
      // The name itself counts more than a title or a place.
      if (score > 0 && matchScore(personLabel(p), q) > 0) score += 4;
    }
    if (score > 0) hits.push({ person: i, score });
  });
  return hits
    .sort(
      (a, b) =>
        b.score - a.score ||
        (data.people[a.person].birth ?? 9999) -
          (data.people[b.person].birth ?? 9999),
    )
    .slice(0, limit);
}

/**
 * Was this person alive in `year`? Without a death date, someone counts as
 * alive for 90 years after birth, unless marked deceased. Living people shown
 * as placeholders are alive only at the present day.
 */
export function aliveIn(
  p: TreePerson,
  year: number,
  now = new Date().getFullYear(),
): boolean {
  if (p.hidden) return year >= now;
  if (p.birth === null) return false;
  if (p.birth > year) return false;
  if (p.death !== null) return p.death >= year;
  if (p.deceased) return p.birth + 90 >= year;
  return true;
}

/** The century someone belongs to: of their birth, or else of their death. */
export function centuryOf(p: TreePerson): number | null {
  const year = p.birth ?? p.death;
  return year === null ? null : Math.floor((year - 1) / 100) + 1;
}

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** « XVe siècle », « 15th century », « 15. Jahrhundert ». */
export function centuryLabel(century: number, locale: string): string {
  if (locale === "en") {
    const suffix =
      century % 100 >= 11 && century % 100 <= 13
        ? "th"
        : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
            century % 10
          ] ?? "th");
    return `${century}${suffix} century`;
  }
  if (locale === "de") return `${century}. Jahrhundert`;
  let rest = century;
  let roman = "";
  for (const [value, letters] of ROMAN) {
    while (rest >= value) {
      roman += letters;
      rest -= value;
    }
  }
  return `${roman}${century === 1 ? "er" : "e"} siècle`;
}

export type Filters = {
  branch: number | null;
  century: number | null;
  title: number | null;
  photo: "with" | "without" | null;
};

export const NO_FILTERS: Filters = {
  branch: null,
  century: null,
  title: null,
  photo: null,
};

export function activeFilterCount(f: Filters): number {
  return [f.branch, f.century, f.title, f.photo].filter((v) => v !== null)
    .length;
}

export function matchesFilters(p: TreePerson, f: Filters): boolean {
  if (f.branch !== null && p.branch !== f.branch) return false;
  if (f.century !== null && centuryOf(p) !== f.century) return false;
  if (f.title !== null && !p.titles.includes(f.title)) return false;
  if (f.photo === "with" && !p.portrait) return false;
  if (f.photo === "without" && p.portrait) return false;
  return true;
}

/** Number of descendants of a person (each counted once). */
export function descendantCount(graph: Graph, root: number): number {
  const seen = new Set<number>([root]);
  const stack = [root];
  while (stack.length) {
    for (const c of graph.children[stack.pop()!]) {
      if (!seen.has(c)) {
        seen.add(c);
        stack.push(c);
      }
    }
  }
  return seen.size - 1;
}

/**
 * Where the tree opens: the default entry point chosen by the family, or
 * else the oldest person without parents who has the most descendants.
 */
export function defaultRoot(data: TreeData, model: TreeModel): number {
  const entry =
    data.entryPoints.find((e) => e.isDefault) ?? data.entryPoints[0];
  if (entry) return entry.person;
  let best = -1;
  let bestCount = -1;
  data.people.forEach((p, i) => {
    if (model.graph.parents[i].length) return;
    const count = descendantCount(model.graph, i);
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  });
  return Math.max(best, 0);
}

/**
 * The chain of people from `root` down to `target` (both included), going
 * through children in descendants view or parents in ancestors view, or null
 * when `target` is not on that side of `root`.
 */
export function chainTo(
  graph: Graph,
  root: number,
  target: number,
  up: boolean,
): number[] | null {
  const next = up ? graph.parents : graph.children;
  const previous = new Map<number, number>();
  const queue = [root];
  const seen = new Set(queue);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === target) break;
    for (const n of next[id]) {
      if (seen.has(n)) continue;
      seen.add(n);
      previous.set(n, id);
      queue.push(n);
    }
  }
  if (!seen.has(target)) return null;
  const chain = [target];
  for (let id = target; id !== root;) {
    id = previous.get(id)!;
    chain.unshift(id);
  }
  return chain;
}

/** The last person of each extinct branch, who gets the barred end. */
export function extinctEnds(data: TreeData, graph: Graph): Map<number, number> {
  const ends = new Map<number, number>();
  data.branches.forEach((b, bi) => {
    if (!b.extinct) return;
    let best = -1;
    let bestYear = -Infinity;
    data.people.forEach((p, i) => {
      if (p.branch !== bi) return;
      const inBranch = graph.children[i].some(
        (c) => data.people[c].branch === bi,
      );
      if (inBranch) return;
      const year = p.death ?? p.birth ?? -Infinity;
      if (year > bestYear) {
        best = i;
        bestYear = year;
      }
    });
    if (best >= 0) ends.set(best, bi);
  });
  return ends;
}
