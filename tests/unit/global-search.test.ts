import { describe, expect, it } from "vitest";
import {
  highlightRanges,
  searchAll,
  suggest,
  type SearchEntry,
} from "@/lib/search/global";

const entry = (
  kind: SearchEntry["kind"],
  name: string,
  detail = "",
  words = "",
): SearchEntry => ({ kind, slug: name.toLowerCase(), name, detail, words });

const index: SearchEntry[] = [
  entry("person", "Albert Exemple", "1850 – 1921 · Branche d’Exemple"),
  entry("person", "Berthe Modèle", "1856 – 1930", "Dame de Croÿ-Exemple"),
  entry("place", "Château d’Exempleville", "1400 – 1800"),
  entry("event", "Bataille d’essai", "1415 · Exempleville"),
  entry("branch", "Branche d’Exemple"),
  entry("title", "Dame de Croÿ-Exemple", "Berthe Modèle"),
  entry("story", "Le verger d’Albert", "Une histoire d’exemple."),
];

describe("global search", () => {
  it("covers every kind at once, grouped in a fixed order", () => {
    const groups = searchAll(index, "exemple");
    expect(groups.map((g) => g.kind)).toEqual([
      "person",
      "story",
      "place",
      "event",
      "branch",
      "title",
    ]);
  });

  it("ignores accents, case and spelling variants", () => {
    expect(searchAll(index, "modele")[0].entries[0].name).toBe("Berthe Modèle");
    expect(searchAll(index, "CHATEAU")[0].kind).toBe("place");
    const crouy = searchAll(index, "crouy");
    expect(crouy.map((g) => g.kind)).toEqual(["person", "title"]);
  });

  it("finds by year and by words that are not shown", () => {
    expect(searchAll(index, "1415")[0].entries[0].name).toBe(
      "Bataille d’essai",
    );
    expect(searchAll(index, "dame croy")[0].entries[0].name).toBe(
      "Berthe Modèle",
    );
  });

  it("ranks a match on the name before a match on the details", () => {
    const people = searchAll(index, "albert");
    expect(people[0].entries[0].name).toBe("Albert Exemple");
    const all = suggest(index, "exemple", 3);
    expect(all[0].name).toBe("Albert Exemple");
  });

  it("counts every match but keeps a few per group", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      entry("person", `Personne ${i}`),
    );
    const [group] = searchAll(many, "personne", 8);
    expect(group.total).toBe(20);
    expect(group.entries).toHaveLength(8);
  });

  it("returns nothing for an empty query", () => {
    expect(searchAll(index, "  ")).toEqual([]);
  });
});

describe("highlightRanges", () => {
  it("marks the start of the words that matched, accents ignored", () => {
    const text = "Berthe Modèle";
    const [range] = highlightRanges(text, "mode");
    expect(text.slice(...range)).toBe("Modè");
  });

  it("only marks the start of a word", () => {
    expect(highlightRanges("Albert", "bert")).toEqual([]);
    expect(highlightRanges("Le verger d’Albert", "alb")).toEqual([[12, 15]]);
  });
});
