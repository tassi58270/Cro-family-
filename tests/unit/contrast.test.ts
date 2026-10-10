import { describe, expect, it } from "vitest";
import { contrast, passes } from "@/lib/design/contrast";
import { palette } from "@/lib/design/palette";

describe("contrast", () => {
  it("matches known WCAG values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("confirms the figures quoted in CLAUDE.md", () => {
    expect(contrast("#c8102e", "#ffffff")).toBeCloseTo(5.9, 1);
    expect(contrast("#c8102e", "#141414")).toBeCloseTo(3.1, 1);
    expect(contrast("#8a8a86", "#ffffff")).toBeCloseTo(3.5, 1);
  });
});

describe.each(["light", "dark"] as const)("%s theme", (theme) => {
  const c = palette[theme];

  it("keeps body and muted text readable on both backgrounds", () => {
    for (const background of [c.paper, c.paper2]) {
      expect(passes(contrast(c.ink, background), "small")).toBe(true);
      expect(passes(contrast(c.inkMuted, background), "small")).toBe(true);
    }
  });

  it("keeps small red text readable", () => {
    expect(passes(contrast(c.croyText, c.paper), "small")).toBe(true);
  });

  it("keeps white text readable on red buttons, at rest and on hover", () => {
    expect(passes(contrast("#ffffff", c.croy), "small")).toBe(true);
    expect(passes(contrast("#ffffff", c.croyDeep), "small")).toBe(true);
  });

  it("keeps the red bands visible against the page", () => {
    expect(passes(contrast(c.croy, c.paper), "large")).toBe(true);
  });
});
