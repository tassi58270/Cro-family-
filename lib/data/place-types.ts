import type { FuzzyDate } from "@/lib/genealogie/dates";
import type { Locale } from "@/lib/i18n/routing";

/** Shared by the server loaders and the map: no server-only import here. */

export type Localized = { text: string; lang: Locale };

export const PLACE_KINDS = [
  "castle",
  "town",
  "estate",
  "battlefield",
  "church",
  "other",
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const EVENT_KINDS = [
  "birth",
  "marriage",
  "death",
  "title",
  "battle",
  "acquisition",
  "extinction",
  "other",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type LinkedPerson = { slug: string; name: string; years: string };
export type LinkedStory = { slug: string; title: Localized };
export type PlacePhoto = {
  id: string;
  path: string;
  width: number | null;
  height: number | null;
  caption: Localized | null;
};

export type MapPlace = {
  id: string;
  slug: string;
  name: Localized;
  kind: PlaceKind;
  lat: number | null;
  lng: number | null;
  country: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  visitable: boolean;
  /** The beginning of the description, for the card on the map. */
  summary: Localized | null;
  photo: PlacePhoto | null;
  people: LinkedPerson[];
  stories: LinkedStory[];
  isDemo: boolean;
};

export type TimelineEvent = {
  id: string;
  slug: string;
  kind: EventKind;
  title: Localized;
  description: Localized | null;
  date: FuzzyDate | null;
  year: number | null;
  placeId: string | null;
  /** The event's own branch and those of the people in it. */
  branchIds: string[];
  people: LinkedPerson[];
  stories: LinkedStory[];
  isDemo: boolean;
};

export type BranchOption = { id: string; name: string; color: string | null };

export type PlacesIndex = {
  places: MapPlace[];
  events: TimelineEvent[];
  branches: BranchOption[];
};

export type PlaceDetail = MapPlace & {
  description: Localized | null;
  visitInfo: Localized | null;
  photos: PlacePhoto[];
  /** Linked by an administrator, with the role they played there. */
  linked: (LinkedPerson & { role: string | null })[];
  born: LinkedPerson[];
  died: LinkedPerson[];
  events: TimelineEvent[];
};
