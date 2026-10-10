import { describe, expect, it } from "vitest";
import { lifespan, lifespanYears, personName } from "@/lib/genealogie/names";

const undated = {
  birth_date: null,
  birth_precision: null,
  death_date: null,
  death_precision: null,
  deceased: false,
};

describe("personName", () => {
  it("joins first names, surname and nickname", () => {
    expect(
      personName({
        given_names: "Antoine",
        surname: "de Croÿ",
        epithet: "le Grand",
      }),
    ).toBe("Antoine de Croÿ, le Grand");
    expect(
      personName({ given_names: "Jean", surname: null, epithet: null }),
    ).toBe("Jean");
  });

  it("prefers the name written for the language", () => {
    expect(
      personName({
        given_names: "Jean",
        surname: "de Croÿ",
        epithet: null,
        display_name: "John of Croÿ",
      }),
    ).toBe("John of Croÿ");
  });
});

describe("lifespan", () => {
  it("writes uncertain dates with « vers »", () => {
    expect(
      lifespan(
        {
          birth_date: "1360-01-01",
          birth_precision: "about",
          death_date: "1415-10-25",
          death_precision: "day",
          deceased: false,
        },
        "fr",
      ),
    ).toBe("vers 1360 – 25 octobre 1415");
  });

  it("shows an unknown end for the dead without a date", () => {
    expect(
      lifespan(
        {
          ...undated,
          birth_date: "1890-01-01",
          birth_precision: "year",
          deceased: true,
        },
        "fr",
      ),
    ).toBe("1890 – ?");
  });

  it("is empty when nothing is known", () => {
    expect(lifespan(undated, "fr")).toBe("");
  });

  it("has a short form in years", () => {
    expect(
      lifespanYears({
        birth_date: "1360-01-01",
        birth_precision: "about",
        death_date: "1415-10-25",
        death_precision: "day",
        deceased: false,
      }),
    ).toBe("v. 1360 – 1415");
  });
});
