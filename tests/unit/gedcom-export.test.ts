import { describe, expect, it } from "vitest";
import { parseGedcom } from "@/lib/genealogie/gedcom";
import { buildGedcom, toCsv } from "@/lib/genealogie/gedcom-export";

const tree = {
  people: [
    {
      id: "a",
      givenNames: "Albert",
      surname: "Exemple",
      epithet: null,
      sex: "male" as const,
      birth: { date: "1850-01-01", precision: "about" as const },
      birthPlace: "Exempleville",
      death: { date: "1921-03-12", precision: "day" as const },
      deathPlace: null,
      deceased: true,
    },
    {
      id: "b",
      givenNames: "Berthe",
      surname: "Modèle",
      epithet: null,
      sex: "female" as const,
      birth: null,
      birthPlace: null,
      death: null,
      deathPlace: null,
      deceased: true,
    },
    {
      id: "c",
      givenNames: "Charles",
      surname: "Exemple",
      epithet: "le Jeune",
      sex: "unknown" as const,
      birth: { date: "1880-01-01", precision: "year" as const },
      birthPlace: null,
      death: null,
      deathPlace: null,
      deceased: false,
    },
    {
      id: "d",
      givenNames: "Denise",
      surname: null,
      epithet: null,
      sex: "female" as const,
      birth: null,
      birthPlace: null,
      death: null,
      deathPlace: null,
      deceased: false,
    },
  ],
  unions: [
    {
      id: "u",
      a: "a",
      b: "b",
      marriage: { date: "1878-01-01", precision: "year" as const },
      marriagePlace: "Essai-sur-Mer",
    },
  ],
  filiations: [
    { parent: "a", child: "c" },
    { parent: "b", child: "c" },
    { parent: "c", child: "d" },
  ],
};

describe("GEDCOM export", () => {
  it("is read back by our own import, dates and families included", () => {
    const text = buildGedcom(tree, new Date("2026-10-14"));
    expect(text.startsWith("0 HEAD\r\n")).toBe(true);
    expect(text.trimEnd().endsWith("0 TRLR")).toBe(true);
    const data = parseGedcom(text);
    expect(data.people.map((p) => p.givenNames)).toEqual([
      "Albert",
      "Berthe",
      "Charles",
      "Denise",
    ]);
    const albert = data.people[0];
    expect(albert.birth?.date).toEqual({
      date: "1850-01-01",
      precision: "about",
    });
    expect(albert.birth?.place).toBe("Exempleville");
    expect(albert.death?.date).toEqual({
      date: "1921-03-12",
      precision: "day",
    });
    expect(data.people[2].epithet).toBe("le Jeune");
    expect(data.people[1].deceased).toBe(true);

    expect(data.families).toHaveLength(2);
    const marriage = data.families.find((f) => f.partners.length === 2)!;
    expect(marriage.children).toHaveLength(1);
    expect(marriage.marriage?.place).toBe("Essai-sur-Mer");
    // A parent alone still has a family, so the child keeps a parent.
    const single = data.families.find((f) => f.partners.length === 1)!;
    expect(single.children).toHaveLength(1);
  });
});

describe("CSV", () => {
  it("quotes what needs to be, for a French spreadsheet", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        { a: "x;y", b: 'dit "le Grand"' },
        { a: null, b: 2 },
      ],
    );
    expect(csv).toBe('﻿a;b\r\n"x;y";"dit ""le Grand"""\r\n;2\r\n');
  });
});
