import { describe, expect, it } from "vitest";
import { justify } from "@/lib/photos/justify";

describe("the justified photo wall", () => {
  const ratios = [1.5, 0.75, 1.33, 1, 2, 0.66, 1.5, 1.5, 1];

  it("fills each full row to the width of the screen", () => {
    const rows = justify([...ratios], 1000, 220, 8);
    for (const row of rows.slice(0, -1)) {
      const width =
        row.tiles.reduce((s, t) => s + t.width, 0) + 8 * (row.tiles.length - 1);
      expect(width).toBeCloseTo(1000, 5);
    }
  });

  it("keeps the order and every photo", () => {
    const rows = justify([...ratios], 1000, 220, 8);
    expect(rows.flatMap((r) => r.tiles.map((t) => t.index))).toEqual(
      ratios.map((_, i) => i),
    );
  });

  it("never stretches the last row beyond the target height", () => {
    const rows = justify([1, 1], 1000, 220, 8);
    expect(rows).toHaveLength(1);
    expect(rows[0].height).toBe(220);
  });

  it("copes with unknown sizes", () => {
    const rows = justify([NaN, 0, 50], 380, 140, 4);
    expect(
      rows
        .flatMap((r) => r.tiles)
        .every((t) => t.width > 0 && Number.isFinite(t.width)),
    ).toBe(true);
  });
});
