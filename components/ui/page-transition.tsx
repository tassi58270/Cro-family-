"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/lib/i18n/navigation";

const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

/** Lets a page play the sweep on demand, e.g. the replay button of /style. */
export const PLAY_TRANSITION_EVENT = "croy:page-transition";

function sweep(container: HTMLElement | null) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return [];
  const bands = container?.querySelectorAll<HTMLElement>("[data-band]");
  return [...(bands ?? [])].map((band, i) =>
    band.animate(
      [
        { transform: "scaleX(0)", transformOrigin: "left center" },
        {
          transform: "scaleX(1)",
          transformOrigin: "left center",
          offset: 0.48,
        },
        {
          transform: "scaleX(1)",
          transformOrigin: "right center",
          offset: 0.52,
        },
        { transform: "scaleX(0)", transformOrigin: "right center" },
      ],
      { duration: 520, delay: i * 40, easing: EASE_IN_OUT, fill: "both" },
    ),
  );
}

/**
 * Page transition (cahier des charges, section 3): when the page changes,
 * the three red bands of the coat of arms sweep across the screen from left
 * to right. The new page is already there underneath and stays usable; the
 * old one crossfades out through the browser's view transition.
 */
export function PageTransition() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const animations = sweep(ref.current);
    return () => animations.forEach((a) => a.cancel());
  }, [pathname]);

  useEffect(() => {
    const play = () => sweep(ref.current);
    window.addEventListener(PLAY_TRANSITION_EVENT, play);
    return () => window.removeEventListener(PLAY_TRANSITION_EVENT, play);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-1/2 z-[70] h-[30svh] -translate-y-1/2 motion-reduce:hidden"
    >
      {[1, 3, 5].map((row) => (
        <span
          key={row}
          data-band
          className="absolute inset-x-0 h-[calc(100%/7)] scale-x-0 bg-croy"
          style={{ top: `calc(100% * ${row} / 7)` }}
        />
      ))}
    </div>
  );
}
