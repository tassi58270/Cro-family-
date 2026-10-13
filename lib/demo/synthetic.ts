/**
 * A large fictional family for performance tests (« l'arbre reste fluide
 * avec 2 000 personnes de test », step 6). Deterministic: the same size
 * always gives the same family. Names say plainly that they are tests.
 */

import type { TreeData } from "@/lib/data/tree";

export type SyntheticPerson = {
  key: number;
  given: string;
  surname: string;
  sex: "female" | "male";
  birth: number;
  death: number | null;
};

export type SyntheticFamily = {
  people: SyntheticPerson[];
  /** [partner a, partner b, marriage year] */
  unions: [number, number, number][];
  /** [parent, child, union index] */
  links: [number, number, number][];
};

const GIVEN_M = [
  "Jean",
  "Louis",
  "Charles",
  "Pierre",
  "Henri",
  "Paul",
  "Jacques",
  "Antoine",
  "Philippe",
  "Guillaume",
];
const GIVEN_F = [
  "Marie",
  "Anne",
  "Louise",
  "Claire",
  "Hélène",
  "Isabelle",
  "Catherine",
  "Jeanne",
  "Sophie",
  "Agnès",
];

export function syntheticFamily(size: number): SyntheticFamily {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const people: SyntheticPerson[] = [];
  const unions: [number, number, number][] = [];
  const links: [number, number, number][] = [];

  const add = (sex: "female" | "male", birth: number, surname: string) => {
    const key = people.length;
    const names = sex === "male" ? GIVEN_M : GIVEN_F;
    const death = birth < 1940 ? birth + 40 + Math.floor(random() * 45) : null;
    people.push({
      key,
      given: names[Math.floor(random() * names.length)],
      surname,
      sex,
      birth,
      death,
    });
    return key;
  };

  const queue: number[] = [add("male", 1400, "Test")];
  while (people.length < size && queue.length) {
    const parent = queue.shift()!;
    const p = people[parent];
    const partner = add(
      p.sex === "male" ? "female" : "male",
      p.birth + Math.floor(random() * 6) - 2,
      "Essai",
    );
    const union = unions.push([parent, partner, p.birth + 25]) - 1;
    const count = 1 + Math.floor(random() * 4);
    for (let i = 0; i < count && people.length < size; i++) {
      const child = add(
        random() < 0.5 ? "male" : "female",
        p.birth + 24 + i * 2 + Math.floor(random() * 4),
        "Test",
      );
      links.push([parent, child, union], [partner, child, union]);
      queue.push(child);
    }
  }
  return { people, unions, links };
}

/** The same family as the compact tree file the tree page loads. */
export function syntheticTree(size: number): TreeData {
  const family = syntheticFamily(size);
  return {
    people: family.people.map((p) => ({
      id: `00000000-0000-4000-8000-${String(p.key).padStart(12, "0")}`,
      slug: `test-${p.key}`,
      given: p.given,
      surname: p.surname,
      epithet: null,
      sex: p.sex,
      birth: p.birth,
      birthPrecision: "year",
      death: p.death,
      deathPrecision: p.death === null ? null : "year",
      deceased: p.death !== null,
      branch: -1,
      hidden: false,
      portrait: false,
      titles: [],
      places: [],
      arms: -1,
      originArms: -1,
      originFamily: null,
    })),
    links: family.links.map(([p, c, u]) => [p, c, u, 0]),
    unions: family.unions.map(([a, b, year]) => [a, b, 1, year, 0]),
    branches: [],
    titles: [],
    arms: [],
    entryPoints: [],
    lineages: [],
    members: false,
  };
}
