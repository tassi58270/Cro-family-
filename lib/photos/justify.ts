/**
 * The photo wall as a justified mosaic: photos keep their order and their
 * shape, each row is as wide as the screen, rows are about `target` high.
 */

export type Tile = { index: number; width: number; height: number };
export type Row = { height: number; tiles: Tile[] };

export function justify(
  ratios: number[],
  width: number,
  target: number,
  gap: number,
): Row[] {
  const rows: Row[] = [];
  let current: number[] = [];
  let sum = 0;
  const close = (height: number) => {
    rows.push({
      height,
      tiles: current.map((index) => ({
        index,
        width: Math.max(1, ratios[index] * height),
        height,
      })),
    });
    current = [];
    sum = 0;
  };
  ratios.forEach((raw, index) => {
    // Unknown or extreme shapes are kept between portrait and panorama.
    const ratio =
      Number.isFinite(raw) && raw > 0 ? Math.min(Math.max(raw, 0.4), 3) : 1;
    ratios[index] = ratio;
    current.push(index);
    sum += ratio;
    const natural = sum * target + gap * (current.length - 1);
    if (natural >= width) close((width - gap * (current.length - 1)) / sum);
  });
  if (current.length)
    close(Math.min(target, (width - gap * (current.length - 1)) / sum));
  return rows;
}
