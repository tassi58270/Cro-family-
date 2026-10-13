import { describe, expect, it } from "vitest";
import { matchScore, normalizeForSearch } from "@/lib/search/normalize";

describe("normalizeForSearch", () => {
  it.each([
    ["Croÿ", "croy"],
    ["Crouy", "croy"],
    ["CROY", "croy"],
    ["Aerschot", "aarschot"],
    ["Dülmen", "dulmen"],
    ["Duelmen", "dulmen"],
    ["Le Rœulx", "le roeulx"],
    ["Hélène d’Exemple", "helene d exemple"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeForSearch(input)).toBe(expected);
  });
});

describe("matchScore", () => {
  it("finds a person whatever the spelling", () => {
    expect(matchScore("Antoine de Croÿ", "croy")).toBeGreaterThan(0);
    expect(matchScore("Antoine de Croÿ", "crouy ant")).toBeGreaterThan(0);
    expect(matchScore("Philippe, duc d’Aarschot", "aerschot")).toBeGreaterThan(
      0,
    );
  });

  it("needs every word to start a word", () => {
    expect(matchScore("Antoine de Croÿ", "toine")).toBe(0);
    expect(matchScore("Antoine de Croÿ", "antoine marie")).toBe(0);
  });

  it("ranks whole and early words first", () => {
    expect(matchScore("Jean Exemple", "jean")).toBeGreaterThan(
      matchScore("Jeanne Exemple", "jean"),
    );
  });
});
