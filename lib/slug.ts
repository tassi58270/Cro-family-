const SPECIAL: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ø: "o",
  ł: "l",
  đ: "d",
  þ: "th",
};

/**
 * A readable, shareable address segment from a name:
 * « Antoine Ier de Croÿ » → « antoine-ier-de-croy ».
 */
export function slugify(text: string, maxLength = 80): string {
  const ascii = text
    .toLowerCase()
    .replace(/[æœßøłđþ]/g, (c) => SPECIAL[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.slice(0, maxLength).replace(/-+$/g, "") || "sans-nom";
}

/** Adds -2, -3… until `taken` says the slug is free. */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  for (let n = 2; await taken(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}
