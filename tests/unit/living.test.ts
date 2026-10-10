import { describe, expect, it } from "vitest";
import { isLiving } from "@/lib/genealogie/living";

const today = new Date(Date.UTC(2026, 9, 10));
const person = (over: Partial<Parameters<typeof isLiving>[0]>) => ({
  deceased: false,
  birth_date: null,
  birth_precision: null,
  death_date: null,
  ...over,
});

// Same cases as the database rule (tests/db/privacy.test.ts).
describe("isLiving mirrors app.is_living()", () => {
  it.each([
    ["no date at all", person({}), true],
    ["ticked as deceased", person({ deceased: true }), false],
    [
      "with a death date",
      person({
        birth_date: "1990-01-01",
        birth_precision: "day",
        death_date: "2020-01-01",
      }),
      false,
    ],
    [
      "born in 1980",
      person({ birth_date: "1980-01-01", birth_precision: "year" }),
      true,
    ],
    [
      "born « vers 1922 »",
      person({ birth_date: "1922-01-01", birth_precision: "about" }),
      true,
    ],
    [
      "born « vers 1900 »",
      person({ birth_date: "1900-01-01", birth_precision: "about" }),
      false,
    ],
    [
      "born « après 1850 »",
      person({ birth_date: "1850-01-01", birth_precision: "after" }),
      true,
    ],
    [
      "born « avant 1925 »",
      person({ birth_date: "1925-01-01", birth_precision: "before" }),
      false,
    ],
    [
      "born 100 years and a day ago",
      person({ birth_date: "1926-10-09", birth_precision: "day" }),
      false,
    ],
    [
      "born exactly 100 years ago",
      person({ birth_date: "1926-10-10", birth_precision: "day" }),
      true,
    ],
  ] as const)("%s → %s", (_, p, expected) => {
    expect(isLiving(p, today)).toBe(expected);
  });
});
