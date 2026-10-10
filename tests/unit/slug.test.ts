import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it.each([
    ["Antoine Ier de Croÿ", "antoine-ier-de-croy"],
    ["Louise-Élisabeth de Croÿ-Havré", "louise-elisabeth-de-croy-havre"],
    ["Charles Eugène", "charles-eugene"],
    ["Le Rœulx", "le-roeulx"],
    ["Dülmen", "dulmen"],
    ["Straße", "strasse"],
    ["Árpád", "arpad"],
    ["l’Hermitage", "lhermitage"],
    ["  « Le Bel Auguste »  ", "le-bel-auguste"],
    ["???", "sans-nom"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("matches the database slug format", () => {
    expect(slugify("Jean Ier — 1365 / 1415")).toMatch(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
    );
  });
});

describe("uniqueSlug", () => {
  it("adds a number until the slug is free", async () => {
    const used = new Set(["jean", "jean-2"]);
    expect(await uniqueSlug("jean", async (s) => used.has(s))).toBe("jean-3");
    expect(await uniqueSlug("paul", async (s) => used.has(s))).toBe("paul");
  });
});
