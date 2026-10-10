/** WCAG 2 relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Small text needs 4.5:1; large text (24 px, or 19 px bold) needs 3:1. */
export function passes(ratio: number, size: "small" | "large"): boolean {
  return ratio >= (size === "small" ? 4.5 : 3);
}
