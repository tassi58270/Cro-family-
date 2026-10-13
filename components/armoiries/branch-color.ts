import type { BranchItem } from "@/lib/data/arms";

/** The colour of a branch's line: its own, else a shade of red; grey once extinct. */
export function branchColor(
  b: Pick<BranchItem, "extinct" | "color">,
  index: number,
) {
  if (b.extinct) return "var(--branch-extinct)";
  return b.color ?? `var(--branch-${index % 6})`;
}
