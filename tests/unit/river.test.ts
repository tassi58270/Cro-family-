import { describe, expect, it } from "vitest";
import { layoutRiver, type RiverInput } from "@/lib/genealogie/river";

// Thirteen fictional branches, the size of the family's (cahier, section 2).
const branches: RiverInput[] = Array.from({ length: 13 }, (_, i) => ({
  key: `b${i}`,
  parent: i === 0 ? null : `b${Math.floor((i - 1) / 3)}`,
  start: 1300 + i * 30,
  end: i % 4 === 3 ? null : 1500 + i * 25,
  people: 5 + i * 7,
}));

describe("the river of branches", () => {
  const river = layoutRiver(branches, 2026);

  it("gives every branch its own stream and number", () => {
    expect(river.streams).toHaveLength(13);
    expect(new Set(river.streams.map((s) => s.x)).size).toBe(13);
    expect(river.streams.map((s) => s.number)).toEqual(
      Array.from({ length: 13 }, (_, i) => i + 1),
    );
  });

  it("puts each branch to the right of its parent, starting below it", () => {
    for (const b of branches.filter((b) => b.parent)) {
      const s = river.streams.find((x) => x.key === b.key)!;
      const p = river.streams.find((x) => x.key === b.parent)!;
      expect(s.x).toBeGreaterThan(p.x);
      expect(s.top).toBeGreaterThan(p.top);
    }
  });

  it("runs living branches down to today and stops the extinct ones", () => {
    const living = river.streams.filter((s) => !s.extinct);
    expect(new Set(living.map((s) => s.bottom)).size).toBe(1);
    for (const s of river.streams.filter((s) => s.extinct)) {
      expect(s.bottom).toBeLessThan(living[0].bottom);
    }
  });

  it("draws a thicker line for a branch with more people", () => {
    const widths = river.streams.map((s) => s.width);
    expect(Math.max(...widths)).toBeCloseTo(12);
    expect(widths[0]).toBeLessThan(widths[12]);
  });

  it("copes with unknown years and missing parents", () => {
    const odd = layoutRiver(
      [
        { key: "a", parent: "nobody", start: null, end: null, people: 0 },
        { key: "b", parent: "a", start: null, end: 1700, people: 3 },
      ],
      2026,
    );
    expect(odd.streams).toHaveLength(2);
    for (const s of odd.streams)
      expect(Number.isFinite(s.top) && s.bottom > s.top).toBe(true);
  });

  it("is empty without branches", () => {
    expect(layoutRiver([], 2026).streams).toEqual([]);
  });
});
