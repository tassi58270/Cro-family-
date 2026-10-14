/**
 * A coat of arms drawn by the family arrives as SVG: a text format that can
 * carry scripts. Only the drawing is kept; files are also served with a
 * strict policy and shown through <img>, where nothing could run anyway.
 */
export function sanitizeSvg(input: string): string | null {
  let svg = input.replace(/^﻿/, "").trim();
  if (!/<svg[\s>]/i.test(svg) || svg.length > 2_000_000) return null;
  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|foreignObject|iframe|object|embed|audio|video)\b[\s\S]*?<\/\1\s*>/gi,
      "",
    )
    .replace(
      /<(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*\/?>/gi,
      "",
    )
    // Event handlers: onload="…", onclick='…', onmouseover=…
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Links only to the drawing itself (#…) or to embedded images.
    .replace(
      /\s+(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (attribute, value: string) => {
        const url = value.replace(/^["']|["']$/g, "").trim();
        return url.startsWith("#") ||
          /^data:image\/(png|jpe?g|gif|webp);/i.test(url)
          ? attribute
          : "";
      },
    )
    .replace(/javascript:/gi, "");
  const start = svg.search(/<svg[\s>]/i);
  return start >= 0 ? svg.slice(start) : null;
}
