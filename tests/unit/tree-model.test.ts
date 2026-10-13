import { describe, expect, it } from "vitest";
import type { TreeData, TreePerson } from "@/lib/data/tree";
import { syntheticTree } from "@/lib/demo/synthetic";
import {
  NO_FILTERS,
  aliveIn,
  buildModel,
  centuryLabel,
  centuryOf,
  chainTo,
  defaultRoot,
  extinctEnds,
  matchesFilters,
  personYears,
  searchPeople,
} from "@/lib/genealogie/tree-model";

function person(overrides: Partial<TreePerson>): TreePerson {
  return {
    id: crypto.randomUUID(),
    slug: null,
    given: null,
    surname: null,
    epithet: null,
    sex: "male",
    birth: null,
    birthPrecision: null,
    death: null,
    deathPrecision: null,
    deceased: false,
    branch: -1,
    hidden: false,
    portrait: false,
    titles: [],
    places: [],
    arms: -1,
    originArms: -1,
    originFamily: null,
    ...overrides,
  };
}

const small: TreeData = {
  people: [
    person({
      given: "Jean",
      surname: "de Croÿ",
      birth: 1360,
      birthPrecision: "about",
      death: 1415,
      deathPrecision: "day",
      titles: [0],
      places: ["Azincourt"],
      branch: 0,
    }),
    person({
      given: "Antoine",
      surname: "de Croÿ",
      epithet: "le Grand",
      birth: 1385,
      death: 1475,
      branch: 0,
    }),
    person({
      given: "Marie",
      surname: "de Croy",
      sex: "female",
      birth: 1420,
      death: 1460,
      portrait: true,
      branch: 1,
    }),
    person({ hidden: true }),
    person({
      given: "Philippe",
      surname: "de Croÿ",
      birth: 1440,
      death: 1511,
      branch: 1,
    }),
  ],
  links: [
    [0, 1, -1, 0],
    [1, 2, -1, 1],
    [2, 3, -1, 0],
    [1, 4, -1, 0],
  ],
  unions: [],
  branches: [
    {
      id: "a",
      slug: "a",
      name: "Aînée",
      color: null,
      extinct: false,
      extinctYear: null,
      founder: 0,
      parent: -1,
      arms: -1,
    },
    {
      id: "b",
      slug: "b",
      name: "Cadette",
      color: null,
      extinct: true,
      extinctYear: 1511,
      founder: 2,
      parent: 0,
      arms: -1,
    },
  ],
  titles: [{ id: "t", slug: "t", name: "Seigneur de Croÿ" }],
  arms: [],
  entryPoints: [],
  lineages: [],
  members: false,
};
const model = buildModel(small);

describe("names and years in the tree", () => {
  it("writes uncertain years with « v. », and unknown ends with a question mark", () => {
    expect(personYears(small.people[0], "fr")).toBe("v. 1360 – 1415");
    expect(personYears(small.people[0], "en")).toBe("c. 1360 – 1415");
    expect(personYears(person({ birth: 1500, deceased: true }), "fr")).toBe(
      "1500 – ?",
    );
    expect(personYears(person({ death: 1500 }), "fr")).toBe("? – 1500");
  });
});

describe("the search of the tree", () => {
  const names = (q: string) =>
    searchPeople(small, model, q).map((h) => small.people[h.person].given);

  it("finds a name in any spelling, without accents", () => {
    expect(names("antoine croy")).toEqual(["Antoine"]);
    expect(names("Crouy")).toContain("Jean");
  });

  it("finds by title, place, epithet or year", () => {
    expect(names("seigneur")).toEqual(["Jean"]);
    expect(names("azincourt")).toEqual(["Jean"]);
    expect(names("le grand")).toEqual(["Antoine"]);
    expect(names("1415")[0]).toBe("Jean");
  });

  it("never finds a living person shown as a placeholder", () => {
    expect(searchPeople(small, model, "1980")).toEqual([]);
    expect(model.haystacks[3]).toBe("");
  });

  it("puts the name before a title or a place", () => {
    const data: TreeData = {
      ...small,
      people: [
        person({ given: "Azincourt", surname: "X" }),
        person({ given: "Y", places: ["Azincourt"] }),
      ],
      links: [],
    };
    const hits = searchPeople(data, buildModel(data), "azincourt");
    expect(hits[0].person).toBe(0);
  });
});

describe("the time slider", () => {
  it("lights the people alive in a year", () => {
    expect(aliveIn(small.people[0], 1415)).toBe(true);
    expect(aliveIn(small.people[0], 1416)).toBe(false);
    expect(aliveIn(small.people[0], 1359)).toBe(false);
  });

  it("does not know when someone without a birth date lived", () => {
    expect(aliveIn(person({ death: 1500 }), 1490)).toBe(false);
  });

  it("shows living placeholders only at the present day", () => {
    expect(aliveIn(small.people[3], 1950, 2026)).toBe(false);
    expect(aliveIn(small.people[3], 2026, 2026)).toBe(true);
  });
});

describe("the filters", () => {
  it("count centuries as historians do", () => {
    expect(centuryOf(person({ birth: 1400 }))).toBe(14);
    expect(centuryOf(person({ birth: 1401 }))).toBe(15);
    expect(centuryLabel(15, "fr")).toBe("XVe siècle");
    expect(centuryLabel(1, "fr")).toBe("Ier siècle");
    expect(centuryLabel(19, "fr")).toBe("XIXe siècle");
    expect(centuryLabel(21, "en")).toBe("21st century");
    expect(centuryLabel(12, "en")).toBe("12th century");
    expect(centuryLabel(15, "de")).toBe("15. Jahrhundert");
  });

  it("combine branch, century, title and photo", () => {
    const f = { ...NO_FILTERS, branch: 1, photo: "with" as const };
    expect(
      small.people.filter((p) => matchesFilters(p, f)).map((p) => p.given),
    ).toEqual(["Marie"]);
    expect(
      matchesFilters(small.people[0], { ...NO_FILTERS, title: 0, century: 14 }),
    ).toBe(true);
  });
});

describe("where the tree opens and how it reaches someone", () => {
  it("opens on the family's default entry point", () => {
    const data = {
      ...small,
      entryPoints: [{ label: "x", person: 2, isDefault: true }],
    };
    expect(defaultRoot(data, model)).toBe(2);
  });

  it("otherwise opens on the ancestor with the most descendants", () => {
    expect(defaultRoot(small, model)).toBe(0);
    const big = syntheticTree(500);
    expect(defaultRoot(big, buildModel(big))).toBe(0);
  });

  it("finds the chain of branches to open to reach a person", () => {
    expect(chainTo(model.graph, 0, 3, false)).toEqual([0, 1, 2, 3]);
    expect(chainTo(model.graph, 3, 0, true)).toEqual([3, 2, 1, 0]);
    expect(chainTo(model.graph, 2, 4, false)).toBeNull();
  });

  it("marks the last person of an extinct branch", () => {
    expect([...extinctEnds(small, model.graph)]).toEqual([[4, 1]]);
  });
});
