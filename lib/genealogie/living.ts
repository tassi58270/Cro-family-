import type { DatePrecision } from "./dates";

/**
 * Same rule as app.is_living() in the database, for previews in the
 * interface only: the database alone decides what visitors can see.
 */
export function isLiving(
  p: {
    deceased: boolean;
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
  },
  today = new Date(),
): boolean {
  if (p.deceased || p.death_date) return false;
  if (!p.birth_date || !p.birth_precision || p.birth_precision === "after")
    return true;
  const [y, m, d] = p.birth_date.split("-").map(Number);
  const latest =
    p.birth_precision === "day"
      ? new Date(Date.UTC(y, m - 1, d))
      : p.birth_precision === "month"
        ? new Date(Date.UTC(y, m, 0))
        : new Date(
            Date.UTC(p.birth_precision === "about" ? y + 10 : y, 11, 31),
          );
  const hundredYearsLater = new Date(latest);
  hundredYearsLater.setUTCFullYear(latest.getUTCFullYear() + 100);
  const midnight = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return !(hundredYearsLater < midnight);
}
