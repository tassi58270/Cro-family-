import { describe, expect, it } from "vitest";
import {
  findRelationship,
  relationshipLabel,
  type FamilyGraph,
  type Sex,
} from "@/lib/genealogie/relationship";

// gg ─┬─ g1 ── p1 ── c1 ── d1        p1 ∞ s1 (daughter of sf, sister of ss)
//     └─ g2 ── p2 ── c2              h: child of g1 with another partner
const people: [string, Sex, string[]][] = [
  ["gg", "male", []],
  ["gm", "female", []],
  ["g1", "male", ["gg", "gm"]],
  ["g2", "female", ["gg", "gm"]],
  ["x", "female", []],
  ["h", "male", ["gg", "x"]],
  ["p1", "male", ["g1"]],
  ["p2", "female", ["g2"]],
  ["c1", "male", ["p1"]],
  ["c2", "female", ["p2"]],
  ["d1", "male", ["c1"]],
  ["sf", "male", []],
  ["s1", "female", ["sf"]],
  ["ss", "male", ["sf"]],
];

function graph(): FamilyGraph {
  const g: FamilyGraph = {
    parentsOf: new Map(),
    childrenOf: new Map(),
    spousesOf: new Map([
      ["p1", ["s1"]],
      ["s1", ["p1"]],
    ]),
    sexOf: new Map(),
  };
  for (const [id, sex, parents] of people) {
    g.sexOf.set(id, sex);
    g.parentsOf.set(id, parents);
    for (const p of parents)
      g.childrenOf.set(p, [...(g.childrenOf.get(p) ?? []), id]);
  }
  return g;
}

const g = graph();
const label = (a: string, b: string, locale = "fr") =>
  relationshipLabel(findRelationship(g, a, b), g.sexOf.get(b)!, locale);

describe("findRelationship", () => {
  it("draws the path through the common ancestor", () => {
    const rel = findRelationship(g, "p1", "p2");
    expect(rel).toMatchObject({ kind: "blood", up: 2, down: 2 });
    expect(rel.path).toEqual(["p1", "g1", "gg", "g2", "p2"]);
  });

  it("goes through marriages when there is no common ancestor", () => {
    const rel = findRelationship(g, "c1", "ss");
    expect(rel.kind).toBe("marriage");
    expect(rel.path).toEqual(["c1", "p1", "s1", "sf", "ss"]);
  });

  it("knows when two people are not related", () => {
    expect(findRelationship(g, "c1", "x").kind).not.toBe("blood");
  });
});

describe("relationshipLabel in French", () => {
  it.each([
    ["gg", "c1", "arrière-petit-fils"],
    ["c1", "gg", "arrière-grand-père"],
    ["c1", "p1", "père"],
    ["g1", "g2", "sœur"],
    ["g1", "h", "demi-frère"],
    ["g2", "p1", "neveu"],
    ["g2", "c1", "petit-neveu"],
    ["g2", "d1", "arrière-petit-neveu"],
    ["p1", "g2", "tante"],
    ["c1", "g2", "grand-tante"],
    ["p1", "p2", "cousine germaine"],
    ["c1", "c2", "cousine issue de germain"],
    ["p1", "c2", "cousine germaine, une génération d’écart"],
    ["p1", "s1", "épouse"],
    ["p1", "sf", "beau-père"],
    ["p1", "ss", "beau-frère"],
    ["c1", "c1", "la même personne"],
  ])("%s → %s : %s", (a, b, expected) => {
    expect(label(a, b)).toBe(expected);
  });
});

describe("relationshipLabel in English and German", () => {
  it.each([
    ["g2", "d1", "en", "great-great-nephew"],
    ["c1", "gg", "en", "great-grandfather"],
    ["p1", "c2", "en", "first cousin once removed"],
    ["c1", "c2", "en", "second cousin"],
    ["g2", "d1", "de", "Urgroßneffe"],
    ["c1", "gg", "de", "Urgroßvater"],
    ["c1", "g2", "de", "Großtante"],
    ["p1", "p2", "de", "Cousine ersten Grades"],
    ["p1", "sf", "de", "Schwiegervater"],
  ])("%s → %s (%s): %s", (a, b, locale, expected) => {
    expect(label(a, b, locale)).toBe(expected);
  });
});
