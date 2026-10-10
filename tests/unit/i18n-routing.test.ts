import { describe, expect, it } from "vitest";
import { routing } from "@/lib/i18n/routing";

const entries = Object.entries(routing.pathnames).map(([route, localized]) => ({
  route,
  byLocale: Object.fromEntries(
    routing.locales.map((locale) => [
      locale,
      typeof localized === "string" ? localized : localized[locale],
    ]),
  ) as Record<(typeof routing.locales)[number], string>,
}));

const params = (path: string) => path.match(/\[[^\]]+\]/g) ?? [];

describe("localized addresses", () => {
  it("uses French as the default language", () => {
    expect(routing.defaultLocale).toBe("fr");
    expect(routing.locales).toEqual(["fr", "en", "de"]);
  });

  it.each(entries)("$route is translated in every language", ({ byLocale }) => {
    for (const locale of routing.locales) {
      expect(byLocale[locale], locale).toBeDefined();
    }
  });

  it.each(entries)(
    "$route keeps its French form as the French address",
    ({ route, byLocale }) => {
      expect(byLocale.fr).toBe(route);
    },
  );

  it.each(entries)(
    "$route keeps the same parameters in every language",
    ({ route, byLocale }) => {
      for (const locale of routing.locales) {
        expect(params(byLocale[locale])).toEqual(params(route));
      }
    },
  );

  it.each(entries)(
    "$route is lowercase, without accents or spaces",
    ({ byLocale }) => {
      for (const locale of routing.locales) {
        const path = byLocale[locale].replace(/\[[^\]]+\]/g, "x");
        expect(path, locale).toMatch(/^\/[a-z0-9/-]*$/);
      }
    },
  );

  it("never gives two pages the same address in one language", () => {
    for (const locale of routing.locales) {
      const paths = entries.map(({ byLocale }) => byLocale[locale]);
      expect(new Set(paths).size, locale).toBe(paths.length);
    }
  });
});
