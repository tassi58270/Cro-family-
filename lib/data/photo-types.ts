import type { FuzzyDate } from "@/lib/genealogie/dates";
import type { Localized } from "./home";

/** What the photo pages show; shared by the server and the browser. */

export type PhotoPerson = {
  id: string;
  slug: string | null;
  name: string | null;
  /** x, y, width, height as fractions of the picture. */
  box: [number, number, number, number] | null;
  branch: string | null;
};

export type PhotoItem = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  kind: "photo" | "portrait" | "painting" | "engraving" | "document" | "arms";
  caption: Localized | null;
  alt: string | null;
  date: FuzzyDate | null;
  year: number | null;
  place: { slug: string; name: string } | null;
  event: { slug: string; title: string } | null;
  album: { slug: string; title: string } | null;
  people: PhotoPerson[];
  unidentified: boolean;
  credit: string | null;
  provenance: string | null;
  status: string;
  isDemo: boolean;
};

export type AlbumItem = {
  slug: string;
  title: string;
  description: string | null;
  count: number;
  cover: string | null;
};

export type FaceItem = {
  slug: string;
  name: string;
  years: string;
  url: string;
  box: [number, number, number, number] | null;
  /** Width over height of the picture, to frame the face. */
  ratio: number;
};

export type PhotoIndex = {
  photos: PhotoItem[];
  albums: AlbumItem[];
  faces: FaceItem[];
  branches: { slug: string; name: string }[];
  members: boolean;
};
