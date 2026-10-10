import { describe, expect, it } from "vitest";
import {
  formatFuzzyDate,
  parseFuzzyDate,
  parseGedcomDate,
  toGedcomDate,
} from "@/lib/genealogie/dates";

describe("parseFuzzyDate", () => {
  it.each([
    ["1890", "1890-01-01", "year"],
    ["  1890 ", "1890-01-01", "year"],
    ["vers 1890", "1890-01-01", "about"],
    ["v. 1385", "1385-01-01", "about"],
    ["env. 1890", "1890-01-01", "about"],
    ["about 1890", "1890-01-01", "about"],
    ["c. 1890", "1890-01-01", "about"],
    ["um 1890", "1890-01-01", "about"],
    ["avant 1700", "1700-01-01", "before"],
    ["Après 1700", "1700-01-01", "after"],
    ["vor 1700", "1700-01-01", "before"],
    ["nach 1700", "1700-01-01", "after"],
    ["mars 1890", "1890-03-01", "month"],
    ["12 mars 1890", "1890-03-12", "day"],
    ["1er mars 1890", "1890-03-01", "day"],
    ["12 Février 1890", "1890-02-12", "day"],
    ["25 octobre 1415", "1415-10-25", "day"],
    ["12. März 1890", "1890-03-12", "day"],
    ["12 March 1890", "1890-03-12", "day"],
    ["12/03/1890", "1890-03-12", "day"],
    ["12.03.1890", "1890-03-12", "day"],
    ["03/1890", "1890-03-01", "month"],
    ["1890-03-12", "1890-03-12", "day"],
    ["vers mars 1890", "1890-01-01", "about"],
  ])("%s", (input, date, precision) => {
    expect(parseFuzzyDate(input)).toEqual({ date, precision });
  });

  it.each(["", "demain", "31/02/1890", "13/13/1890", "12 truc 1890", "18.."])(
    "refuses « %s »",
    (input) => {
      expect(parseFuzzyDate(input)).toBeNull();
    },
  );
});

describe("parseGedcomDate", () => {
  it.each([
    ["12 MAR 1450", "1450-03-12", "day"],
    ["MAR 1450", "1450-03-01", "month"],
    ["1450", "1450-01-01", "year"],
    ["ABT 1385", "1385-01-01", "about"],
    ["EST 1385", "1385-01-01", "about"],
    ["BEF 1400", "1400-01-01", "before"],
    ["AFT 1400", "1400-01-01", "after"],
    ["BET 1380 AND 1390", "1380-01-01", "about"],
    ["FROM 1400 TO 1410", "1400-01-01", "about"],
    ["abt 12 mar 1385", "1385-01-01", "about"],
  ])("%s", (input, date, precision) => {
    expect(parseGedcomDate(input)).toEqual({ date, precision });
  });

  it.each([
    "@#DFRENCH R@ 1 VEND 2",
    "(vers la fin du siècle)",
    "30 FEB 1450",
    "",
  ])("refuses « %s »", (input) => {
    expect(parseGedcomDate(input)).toBeNull();
  });

  it("round-trips through the export format", () => {
    for (const text of [
      "12 MAR 1450",
      "MAR 1450",
      "1450",
      "ABT 1385",
      "BEF 1400",
      "AFT 1400",
    ]) {
      expect(toGedcomDate(parseGedcomDate(text)!)).toBe(text);
    }
  });
});

describe("formatFuzzyDate", () => {
  it.each([
    ["fr", { date: "1415-10-25", precision: "day" }, "25 octobre 1415"],
    ["fr", { date: "1890-03-01", precision: "day" }, "1er mars 1890"],
    ["de", { date: "1415-10-25", precision: "day" }, "25. Oktober 1415"],
    ["en", { date: "1415-10-25", precision: "day" }, "25 October 1415"],
    ["fr", { date: "1890-03-01", precision: "month" }, "mars 1890"],
    ["fr", { date: "1385-01-01", precision: "about" }, "vers 1385"],
    ["de", { date: "1385-01-01", precision: "about" }, "um 1385"],
    ["en", { date: "1700-01-01", precision: "before" }, "before 1700"],
    ["fr", { date: "1700-01-01", precision: "after" }, "après 1700"],
    ["fr", { date: "1890-01-01", precision: "year" }, "1890"],
  ] as const)("%s %j", (locale, value, expected) => {
    expect(formatFuzzyDate(value, locale)).toBe(expected);
  });
});
