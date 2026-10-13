import type { Locale } from "@/lib/i18n/routing";
import type { Localized } from "./home";

/** What the stories pages show; shared by the server and the browser. */

export const THEMES_LIST = ["war", "court", "travel", "love", "daily"] as const;
export type Theme = (typeof THEMES_LIST)[number];

export type StoryPerson = {
  slug: string;
  name: string;
  years: string;
  branch: string | null;
  branchName: string | null;
};

export type StoryCard = {
  slug: string;
  title: Localized;
  excerpt: Localized | null;
  eraStart: number | null;
  eraEnd: number | null;
  themes: Theme[];
  originalLocale: Locale;
  featured: boolean;
  cover: {
    url: string;
    width: number | null;
    height: number | null;
    alt: string;
  } | null;
  people: StoryPerson[];
  author: string | null;
  publishedAt: string | null;
  isDemo: boolean;
};

export type StoryDetail = StoryCard & {
  body: Localized | null;
  source: string | null;
  places: { slug: string; name: string }[];
  events: { slug: string; title: string; year: number | null }[];
  neighbours: StoryCard[];
  photos: {
    id: string;
    url: string;
    caption: string | null;
    width: number | null;
    height: number | null;
  }[];
  status: string;
};
