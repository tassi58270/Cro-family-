import type {
  EventKind,
  MapPlace,
  TimelineEvent,
} from "@/lib/data/place-types";

/** The pure logic of the timeline (6.6): filters, centuries, reading order. */

export type TimelineFilters = {
  century: number | null;
  branch: string | null;
  kinds: EventKind[];
};

export const NO_TIMELINE_FILTERS: TimelineFilters = {
  century: null,
  branch: null,
  kinds: [],
};

export function centuryOfYear(year: number): number {
  return Math.floor((year - 1) / 100) + 1;
}

export function activeTimelineFilters(f: TimelineFilters): number {
  return (
    (f.century === null ? 0 : 1) + (f.branch === null ? 0 : 1) + f.kinds.length
  );
}

export function matchesTimeline(e: TimelineEvent, f: TimelineFilters) {
  if (f.century !== null)
    if (e.year === null || centuryOfYear(e.year) !== f.century) return false;
  if (f.branch !== null && !e.branchIds.includes(f.branch)) return false;
  if (f.kinds.length && !f.kinds.includes(e.kind)) return false;
  return true;
}

/** Events by century, oldest first; undated ones last, under null. */
export function byCentury(events: TimelineEvent[]) {
  const groups = new Map<number | null, TimelineEvent[]>();
  const sorted = [...events].sort(
    (a, b) =>
      (a.year ?? Infinity) - (b.year ?? Infinity) ||
      (a.date?.date ?? "").localeCompare(b.date?.date ?? ""),
  );
  for (const e of sorted) {
    const key = e.year === null ? null : centuryOfYear(e.year);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()].map(([century, items]) => ({
    century,
    items,
  }));
}

export function centuriesOf(events: TimelineEvent[]): number[] {
  return [
    ...new Set(
      events.flatMap((e) => (e.year === null ? [] : [centuryOfYear(e.year)])),
    ),
  ].sort((a, b) => a - b);
}

export function kindsOf(events: TimelineEvent[]): EventKind[] {
  return [...new Set(events.map((e) => e.kind))];
}

export function onMap(
  place: MapPlace | undefined,
): place is MapPlace & { lat: number; lng: number } {
  return Boolean(place && place.lat !== null && place.lng !== null);
}

/**
 * « Lecture »: the dated events that have a place on the map, in
 * chronological order.
 */
export function readingSequence(
  events: TimelineEvent[],
  places: Map<string, MapPlace>,
): TimelineEvent[] {
  return byCentury(events)
    .flatMap((g) => g.items)
    .filter(
      (e) => e.year !== null && e.placeId && onMap(places.get(e.placeId)),
    );
}

/** « 1400 – 1789 », « depuis 1400 », « jusqu’en 1789 », or nothing. */
export function periodLabel(
  start: number | null,
  end: number | null,
  words: { since: (year: number) => string; until: (year: number) => string },
): string | null {
  if (start !== null && end !== null)
    return start === end ? String(start) : `${start} – ${end}`;
  if (start !== null) return words.since(start);
  if (end !== null) return words.until(end);
  return null;
}
