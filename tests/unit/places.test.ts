import { describe, expect, it } from "vitest";
import { formatCoordinates, parseCoordinates } from "@/lib/carte/coordinates";
import {
  activeTimelineFilters,
  byCentury,
  centuriesOf,
  centuryOfYear,
  matchesTimeline,
  NO_TIMELINE_FILTERS,
  periodLabel,
  readingSequence,
} from "@/lib/carte/timeline";
import type { MapPlace, TimelineEvent } from "@/lib/data/place-types";

function event(
  slug: string,
  year: number | null,
  extra: Partial<TimelineEvent> = {},
): TimelineEvent {
  return {
    id: slug,
    slug,
    kind: "other",
    title: { text: slug, lang: "fr" },
    description: null,
    date: year === null ? null : { date: `${year}-01-01`, precision: "year" },
    year,
    placeId: null,
    branchIds: [],
    people: [],
    stories: [],
    isDemo: false,
    ...extra,
  };
}

function place(id: string, lat: number | null): MapPlace {
  return {
    id,
    slug: id,
    name: { text: id, lang: "fr" },
    kind: "town",
    lat,
    lng: lat === null ? null : 2,
    country: null,
    periodStart: null,
    periodEnd: null,
    visitable: false,
    summary: null,
    photo: null,
    people: [],
    stories: [],
    isDemo: false,
  };
}

describe("coordinates", () => {
  it("reads what online maps give", () => {
    expect(parseCoordinates("50.45, 4.2")).toEqual([50.45, 4.2]);
    expect(parseCoordinates("50,45 4,2")).toEqual([50.45, 4.2]);
    expect(parseCoordinates("50.45;4.2")).toEqual([50.45, 4.2]);
    expect(parseCoordinates("50.45,4.2")).toEqual([50.45, 4.2]);
    expect(parseCoordinates(" -12.5  -77.03 ")).toEqual([-12.5, -77.03]);
  });

  it("refuses what is not a point on Earth", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("Azincourt")).toBeNull();
    expect(parseCoordinates("50.45")).toBeNull();
    expect(parseCoordinates("95, 4")).toBeNull();
    expect(parseCoordinates("50, 200")).toBeNull();
    expect(parseCoordinates("1, 2, 3")).toBeNull();
  });

  it("writes them back so that they can be read again", () => {
    const text = formatCoordinates(50.45, 4.2);
    expect(parseCoordinates(text)).toEqual([50.45, 4.2]);
  });
});

describe("timeline", () => {
  it("counts centuries as people do", () => {
    expect(centuryOfYear(1415)).toBe(15);
    expect(centuryOfYear(1400)).toBe(14);
    expect(centuryOfYear(1401)).toBe(15);
    expect(centuryOfYear(2000)).toBe(20);
  });

  it("groups by century, oldest first, undated last", () => {
    const groups = byCentury([
      event("b", 1914),
      event("undated", null),
      event("a", 1415),
      event("c", 1918),
    ]);
    expect(groups.map((g) => g.century)).toEqual([15, 20, null]);
    expect(groups[1].items.map((e) => e.slug)).toEqual(["b", "c"]);
    expect(centuriesOf([event("x", 1918), event("y", 1415)])).toEqual([15, 20]);
  });

  it("filters by century, branch and type", () => {
    const battle = event("battle", 1415, { kind: "battle", branchIds: ["b1"] });
    const birth = event("birth", 1856, { kind: "birth" });
    const f = { ...NO_TIMELINE_FILTERS, century: 15 };
    expect(matchesTimeline(battle, f)).toBe(true);
    expect(matchesTimeline(birth, f)).toBe(false);
    expect(
      matchesTimeline(battle, { ...NO_TIMELINE_FILTERS, branch: "b2" }),
    ).toBe(false);
    expect(
      matchesTimeline(birth, { ...NO_TIMELINE_FILTERS, kinds: ["birth"] }),
    ).toBe(true);
    expect(
      activeTimelineFilters({
        century: 15,
        branch: null,
        kinds: ["birth", "battle"],
      }),
    ).toBe(3);
  });

  it("reads only dated events placed on the map, in order", () => {
    const places = new Map([
      ["p1", place("p1", 50)],
      ["p2", place("p2", null)],
    ]);
    const sequence = readingSequence(
      [
        event("late", 1900, { placeId: "p1" }),
        event("early", 1415, { placeId: "p1" }),
        event("nowhere", 1500),
        event("unplaced", 1600, { placeId: "p2" }),
        event("undated", null, { placeId: "p1" }),
      ],
      places,
    );
    expect(sequence.map((e) => e.slug)).toEqual(["early", "late"]);
  });

  it("writes a period in words", () => {
    const words = {
      since: (y: number) => `depuis ${y}`,
      until: (y: number) => `jusqu’en ${y}`,
    };
    expect(periodLabel(1400, 1789, words)).toBe("1400 – 1789");
    expect(periodLabel(1400, null, words)).toBe("depuis 1400");
    expect(periodLabel(null, 1789, words)).toBe("jusqu’en 1789");
    expect(periodLabel(null, null, words)).toBeNull();
  });
});
