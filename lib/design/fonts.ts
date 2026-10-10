import { Atkinson_Hyperlegible_Next, Bodoni_Moda } from "next/font/google";

/**
 * Display serif (direction A « Monument »): Bodoni Moda, with its optical
 * size axis so that very large titles get the fine high-contrast cut.
 * Its ÿ is properly drawn, which the opening screen depends on.
 */
export const bodoni = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-bodoni",
});

/** Text: a sans-serif designed for legibility, for readers of every age. */
export const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // next/font has no metrics for this recent family; the fallback stack is explicit.
  adjustFontFallback: false,
  fallback: ["Segoe UI", "system-ui", "-apple-system", "sans-serif"],
  variable: "--font-atkinson",
});
