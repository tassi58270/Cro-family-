type MessageTree = { [key: string]: string | MessageTree };

/**
 * Deep-merges `overrides` on top of `base`. Used to fall back on the French
 * interface texts when a key is missing in another language.
 */
export function withFallback<T extends MessageTree>(
  base: T,
  overrides: MessageTree,
): T {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const fallback = base[key];
    result[key] =
      typeof value === "object" && typeof fallback === "object"
        ? withFallback(fallback, value)
        : value;
  }
  return result as T;
}
