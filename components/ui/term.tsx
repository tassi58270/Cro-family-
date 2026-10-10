import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * A technical word (fasce, écartelé, branche cadette…) explained in one
 * sentence, on click or tap (cahier des charges, section 3, « Pédagogique »).
 * Uses the native popover: Escape and a click outside close it.
 */
export function Term({
  children,
  definition,
}: {
  /** The word as it appears in the sentence. */
  children: ReactNode;
  /** One plain sentence. */
  definition: ReactNode;
}) {
  const id = useId();
  const popoverId = `term-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchor = `--${popoverId}`;

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        className="term cursor-help underline decoration-croy decoration-dotted decoration-[1.5px] underline-offset-[0.22em] hover:decoration-solid"
        style={{ anchorName: anchor } as CSSProperties}
      >
        {children}
      </button>
      <span
        id={popoverId}
        popover="auto"
        className="term-popover"
        style={{ positionAnchor: anchor } as CSSProperties}
      >
        <span className="font-display text-[1.125rem]">{children}</span>
        <span className="mt-1 block text-ink-muted">{definition}</span>
      </span>
    </>
  );
}
