import type { CSSProperties } from "react";
import type { Localized } from "@/lib/data/home";
import { BandsRule } from "@/components/ui/bands";

/**
 * « En quelques lignes »: three or four sentences in very large type, whose
 * words light up one after the other as the page scrolls (6.1). Without
 * scroll-driven animations or with reduced motion, the text is simply there.
 */
export function Summary({
  id,
  eyebrow,
  summary,
}: {
  id: string;
  eyebrow: string;
  summary: Localized;
}) {
  const paragraphs = summary.text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="page border-t border-hairline py-(--section)"
    >
      <div className="mx-auto grid max-w-4xl gap-8">
        <BandsRule />
        <h2
          id={`${id}-titre`}
          className="text-caption font-medium text-ink-muted"
        >
          {eyebrow}
        </h2>
        <div
          className="grid gap-[0.8em] font-display text-[clamp(1.875rem,1.3rem+2.3vw,3.5rem)] leading-[1.12]"
          lang={summary.lang}
        >
          {paragraphs.map((paragraph, i) => {
            const parts = paragraph.split(/(\s+)/);
            const words = parts.filter((part) => !/^\s+$/.test(part)).length;
            let index = 0;
            return (
              <p key={i} className="summary-line">
                {parts.map((part, j) =>
                  /^\s+$/.test(part) ? (
                    part
                  ) : (
                    <span
                      key={j}
                      className="summary-word"
                      // Position of the word in its paragraph, from 0 to 1.
                      style={
                        {
                          "--p": (index++ / Math.max(1, words - 1)).toFixed(3),
                        } as CSSProperties
                      }
                    >
                      {part}
                    </span>
                  ),
                )}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
