import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeGedcom, parseGedcom, parseNodes } from "@/lib/genealogie/gedcom";

const sample = decodeGedcom(
  readFileSync(new URL("../fixtures/exemple.ged", import.meta.url)),
);

describe("parseGedcom", () => {
  const data = parseGedcom(sample);
  const byXref = Object.fromEntries(data.people.map((p) => [p.xref, p]));

  it("reads every person and family", () => {
    expect(data.people).toHaveLength(4);
    expect(data.families).toHaveLength(1);
  });

  it("splits names into first names, surname and nickname", () => {
    expect(byXref["@I1@"]).toMatchObject({
      givenNames: "Albert",
      surname: "Exemple",
      sex: "male",
    });
    expect(byXref["@I2@"]).toMatchObject({
      givenNames: "Berthe",
      surname: "Modèle",
      sex: "female",
    });
    expect(byXref["@I3@"]).toMatchObject({
      givenNames: "Charles",
      surname: "Exemple",
      epithet: "le Jeune",
    });
    expect(byXref["@I4@"]).toMatchObject({
      givenNames: "Hélène",
      epithet: "la Sage",
    });
  });

  it("reads dates and places, imprecise ones included", () => {
    expect(byXref["@I1@"].birth).toEqual({
      date: { date: "1850-04-02", precision: "day" },
      dateText: "2 APR 1850",
      place: "Exempleville",
    });
    expect(byXref["@I2@"].birth?.date).toEqual({
      date: "1856-01-01",
      precision: "about",
    });
    expect(byXref["@I4@"].birth?.date).toEqual({
      date: "1880-01-01",
      precision: "about",
    });
  });

  it("marks as deceased whoever has a death or a burial, even without date", () => {
    expect(byXref["@I2@"].deceased).toBe(true);
    expect(byXref["@I4@"].deceased).toBe(true);
    expect(byXref["@I4@"].death?.place).toBe("Château d’Exemple");
    expect(byXref["@I3@"].deceased).toBe(false);
  });

  it("links the family, ignoring people missing from the file", () => {
    expect(data.families[0]).toMatchObject({
      partners: ["@I1@", "@I2@"],
      children: ["@I3@", "@I4@"],
      marriage: {
        date: { date: "1878-06-10", precision: "day" },
        place: "Exempleville",
      },
    });
  });

  it("lists what it could not take in", () => {
    expect(data.warnings).toEqual(
      expect.arrayContaining([
        { code: "date", detail: "Charles Exemple : vers la fin de l’hiver" },
        { code: "missing", detail: "@F1@ → @I99@" },
        { code: "notes", detail: "1" },
      ]),
    );
  });
});

describe("parseNodes", () => {
  it("joins continued lines", () => {
    const [note] = parseNodes(
      "0 @N1@ NOTE Première\n1 CONC  suite\n1 CONT Deuxième ligne",
    );
    expect(note.value).toBe("Première suite\nDeuxième ligne");
  });
});

describe("decodeGedcom", () => {
  it("reads files declared in ANSI (Windows-1252)", () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("0 HEAD\n1 CHAR ANSI\n0 @I1@ INDI\n1 NAME H"),
      0xe9, // é in Windows-1252
      ...new TextEncoder().encode("l\xe8ne /Test/\n"),
    ]);
    // \xe8 above was encoded as UTF-8 by TextEncoder; patch it to one byte.
    const fixed = Uint8Array.from(
      [...bytes].flatMap((b, i, all) =>
        b === 0xc3 && all[i + 1] === 0xa8
          ? [0xe8]
          : b === 0xa8 && all[i - 1] === 0xc3
            ? []
            : [b],
      ),
    );
    expect(decodeGedcom(fixed)).toContain("Hélène /Test/");
  });

  it("drops a UTF-8 byte order mark", () => {
    const bytes = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode("0 HEAD"),
    ]);
    expect(decodeGedcom(bytes)).toBe("0 HEAD");
  });
});
