import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/lib/storage/svg";

describe("arms uploaded as SVG", () => {
  it("keeps the drawing", () => {
    const svg =
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 12"><defs><path id="e" d="M0 0h10v12H0z"/></defs><use href="#e" fill="#c8102e"/></svg>';
    const clean = sanitizeSvg(svg)!;
    expect(clean.startsWith("<svg")).toBe(true);
    expect(clean).toContain('href="#e"');
    expect(clean).toContain('fill="#c8102e"');
  });

  it("removes what could run or reach elsewhere", () => {
    const clean = sanitizeSvg(
      `<svg onload="alert(1)"><script>alert(2)</script><foreignObject><div/></foreignObject>
       <a href="javascript:alert(3)"><rect onclick='x()' width="1"/></a>
       <image xlink:href="https://example.org/x.png"/><SCRIPT src="x"/></svg>`,
    )!;
    expect(clean).not.toMatch(
      /onload|onclick|script|foreignObject|javascript|example\.org/i,
    );
    expect(clean).toContain("<rect");
  });

  it("refuses what is not SVG", () => {
    expect(sanitizeSvg("<html><body/></html>")).toBeNull();
    expect(sanitizeSvg("")).toBeNull();
  });
});
