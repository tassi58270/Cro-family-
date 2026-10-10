import { defineRouting } from "next-intl/routing";

/**
 * URL contract of the site (cahier des charges, section 5 « Adresses des pages »).
 *
 * Keys are the internal routes, i.e. the folder names under `app/[locale]`,
 * which are French. Values are the public, translated segments per locale.
 * French is the reference language and the default.
 *
 * The English and German segments still need a review by the family.
 */
export const routing = defineRouting({
  locales: ["fr", "en", "de"],
  defaultLocale: "fr",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/arbre": {
      fr: "/arbre",
      en: "/family-tree",
      de: "/stammbaum",
    },
    "/arbre/[personne]": {
      fr: "/arbre/[personne]",
      en: "/family-tree/[personne]",
      de: "/stammbaum/[personne]",
    },
    "/armoiries": {
      fr: "/armoiries",
      en: "/coats-of-arms",
      de: "/wappen",
    },
    "/branches/[branche]": {
      fr: "/branches/[branche]",
      en: "/branches/[branche]",
      de: "/linien/[branche]",
    },
    "/titres/[titre]": {
      fr: "/titres/[titre]",
      en: "/titles/[titre]",
      de: "/titel/[titre]",
    },
    "/histoires": {
      fr: "/histoires",
      en: "/stories",
      de: "/geschichten",
    },
    "/histoires/[histoire]": {
      fr: "/histoires/[histoire]",
      en: "/stories/[histoire]",
      de: "/geschichten/[histoire]",
    },
    "/lieux-et-evenements": {
      fr: "/lieux-et-evenements",
      en: "/places-and-events",
      de: "/orte-und-ereignisse",
    },
    "/lieux/[lieu]": {
      fr: "/lieux/[lieu]",
      en: "/places/[lieu]",
      de: "/orte/[lieu]",
    },
    "/recherche": {
      fr: "/recherche",
      en: "/search",
      de: "/suche",
    },
    "/contribuer": {
      fr: "/contribuer",
      en: "/contribute",
      de: "/beitragen",
    },
    "/connexion": {
      fr: "/connexion",
      en: "/sign-in",
      de: "/anmelden",
    },
    "/compte": {
      fr: "/compte",
      en: "/account",
      de: "/konto",
    },
    "/admin": "/admin",
  },
});

export type Locale = (typeof routing.locales)[number];
