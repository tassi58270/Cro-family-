import { describe, expect, it } from "vitest";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

type Tree = { [key: string]: string | Tree };

function texts(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : texts(value, `${prefix}${key}.`),
  );
}

describe("French typography of the interface texts", () => {
  const all = texts(fr);

  it("puts a narrow no-break space before ; : ! ?", () => {
    for (const [key, text] of all) {
      expect(text, key).not.toMatch(/[^ ][;:!?](\s|$)/u);
    }
  });

  it("puts no-break spaces inside « »", () => {
    for (const [key, text] of all) {
      expect(text, key).not.toMatch(/«(?! )|(?<! )»/u);
    }
  });
});

describe.each([
  ["fr", fr],
  ["en", en],
  ["de", de],
])("%s interface texts", (_, messages) => {
  it("use the typographic apostrophe and no straight quotes", () => {
    for (const [key, text] of texts(messages)) {
      expect(text, key).not.toMatch(/['"]/);
    }
  });
});
