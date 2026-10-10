import { describe, expect, it } from "vitest";
import { frenchTypography, typeset } from "@/lib/typography";

describe("frenchTypography", () => {
  it.each([
    ["Il dit : bonjour", "Il dit : bonjour"],
    ["Vraiment ? Oui !", "Vraiment ? Oui !"],
    ["Vraiment? Oui!", "Vraiment ? Oui !"],
    ["« croui »", "« croui »"],
    ["«croui»", "« croui »"],
    ["l'histoire d'un duc", "l’histoire d’un duc"],
  ])("%s", (input, expected) => {
    expect(frenchTypography(input)).toBe(expected);
  });

  it("leaves times and addresses alone", () => {
    expect(frenchTypography("à 10:30, voir https://example.org")).toBe(
      "à 10:30, voir https://example.org",
    );
  });

  it("only applies to French", () => {
    expect(typeset("Hello : world", "en")).toBe("Hello : world");
  });
});
