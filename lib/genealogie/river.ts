/**
 * The branches drawn as a river (cahier des charges, 6.3): from the source
 * down to today, each branch leaves its parent the year it starts and flows
 * until it dies out, its line as thick as it has people. Pure geometry, so
 * that it can be tested; years run downward.
 */

export type RiverInput = {
  key: string;
  parent: string | null;
  start: number | null;
  /** Year it died out, or null if it still lives. */
  end: number | null;
  people: number;
};

export type Stream = {
  key: string;
  /** Order of the branch, from 1, for the legend. */
  number: number;
  x: number;
  top: number;
  bottom: number;
  width: number;
  d: string;
  extinct: boolean;
};

export type River = {
  streams: Stream[];
  width: number;
  height: number;
  /** Year marks for the time axis. */
  ticks: { year: number; y: number }[];
};

const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 48;
const AXIS = 64;
const COLUMN = 56;

export function layoutRiver(
  input: RiverInput[],
  now: number,
  /** Defaults to a height that suits the span of years. */
  fixedHeight?: number,
): River {
  if (!input.length) return { streams: [], width: 0, height: 0, ticks: [] };
  const keys = new Set(input.map((b) => b.key));
  const childrenOf = (parent: string | null) =>
    input
      .filter(
        (b) => (b.parent && keys.has(b.parent) ? b.parent : null) === parent,
      )
      .sort((a, b) => (a.start ?? 99999) - (b.start ?? 99999));

  // Depth-first: each branch to the right of its parent, before its siblings.
  const order: RiverInput[] = [];
  const visit = (b: RiverInput) => {
    order.push(b);
    childrenOf(b.key).forEach(visit);
  };
  childrenOf(null).forEach(visit);
  // Branches caught in a loop of parents are drawn at the end.
  for (const b of input) if (!order.includes(b)) order.push(b);

  const known = input
    .flatMap((b) => [b.start, b.end])
    .filter((y): y is number => y !== null);
  const first = Math.floor(Math.min(...known, now) / 50) * 50;
  const span = Math.max(now - first, 1);
  const height =
    fixedHeight ?? Math.round(Math.min(760, Math.max(440, span * 1.4)));
  const inner = height - MARGIN_TOP - MARGIN_BOTTOM;
  const y = (year: number) => MARGIN_TOP + ((year - first) / span) * inner;
  const most = Math.max(...input.map((b) => b.people), 1);

  const placed = new Map<string, Stream>();
  const streams = order.map((b, i) => {
    const x = AXIS + COLUMN / 2 + i * COLUMN;
    const parent = b.parent ? placed.get(b.parent) : undefined;
    const startYear = b.start ?? (parent ? null : first);
    let top =
      startYear === null
        ? parent
          ? parent.top + 24
          : MARGIN_TOP
        : y(startYear);
    if (parent) top = Math.max(top, parent.top + 12);
    const bottom = Math.max(b.end !== null ? y(b.end) : y(now), top + 12);
    const width = 2 + 10 * Math.sqrt(b.people / most);
    const d = parent
      ? `M${parent.x} ${top}C${parent.x} ${top + 18} ${x} ${top + 6} ${x} ${top + 28}V${bottom}`
      : `M${x} ${top}V${bottom}`;
    const stream: Stream = {
      key: b.key,
      number: i + 1,
      x,
      top,
      bottom,
      width,
      d,
      extinct: b.end !== null,
    };
    placed.set(b.key, stream);
    return stream;
  });

  const step = span > 600 ? 100 : span > 250 ? 50 : 25;
  const ticks: River["ticks"] = [];
  for (let year = first; year <= now; year += step)
    ticks.push({ year, y: y(year) });

  return { streams, width: AXIS + order.length * COLUMN + 24, height, ticks };
}
