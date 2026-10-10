import { describe, expect, it } from "vitest";
import { withFallback } from "@/lib/i18n/messages";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else for (const entry of leaves(value, path)) result.set(...entry);
  }
  return result;
}

const reference = leaves(fr);

describe.each([
  ["en", en],
  ["de", de],
])("interface texts in %s", (_, messages) => {
  const translated = leaves(messages);

  it("has exactly the same keys as French", () => {
    expect([...translated.keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it("has no empty text", () => {
    for (const [key, value] of translated) {
      expect(value.trim(), key).not.toBe("");
    }
  });
});

describe("withFallback", () => {
  it("keeps translated texts and fills missing ones from French", () => {
    const base = { a: "fr-a", nested: { b: "fr-b", c: "fr-c" } };
    const merged = withFallback(base, { nested: { b: "en-b" } });
    expect(merged).toEqual({ a: "fr-a", nested: { b: "en-b", c: "fr-c" } });
  });

  it("does not mutate the reference messages", () => {
    const base = { nested: { b: "fr-b" } };
    withFallback(base, { nested: { b: "en-b" } });
    expect(base.nested.b).toBe("fr-b");
  });
});
