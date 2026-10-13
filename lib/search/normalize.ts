/**
 * Matching that ignores accents, case and the known spelling variants of the
 * family's names (cahier des charges, section 5: « Croÿ, Croy, Crouy ;
 * Aarschot, Aerschot »).
 */

const SPECIAL: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ø: "o",
  ł: "l",
};

// Every spelling on the left is searched as the one on the right.
const VARIANTS: [RegExp, string][] = [
  [/\bcrouy\b/g, "croy"],
  [/\bcroi\b/g, "croy"],
  [/\baerschot\b/g, "aarschot"],
  [/\bdulmen\b/g, "dulmen"],
  [/\bduelmen\b/g, "dulmen"],
  [/\bhavre\b/g, "havre"],
  [/\broeulx\b/g, "roeulx"],
  [/\brœulx\b/g, "roeulx"],
];

export function normalizeForSearch(text: string): string {
  let value = text
    .toLowerCase()
    .replace(/[æœßøł]/g, (c) => SPECIAL[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const [pattern, replacement] of VARIANTS)
    value = value.replace(pattern, replacement);
  return value;
}

/**
 * Score of a text against a query: every word of the query must start a word
 * of the text. Higher is better; 0 means no match.
 */
export function matchScore(haystack: string, query: string): number {
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  if (!words.length) return 0;
  const text = ` ${normalizeForSearch(haystack)}`;
  let score = 0;
  for (const word of words) {
    const at = text.indexOf(` ${word}`);
    if (at < 0) return 0;
    // Whole words and early matches rank first.
    const whole =
      text.startsWith(` ${word} `, at) || text.length === at + word.length + 1;
    score += (whole ? 3 : 2) + (at === 0 ? 1 : 0);
  }
  return score;
}
