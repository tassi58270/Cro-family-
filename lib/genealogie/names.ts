import { formatFuzzyDate, type DatePrecision } from "./dates";

export type NamedPerson = {
  given_names: string | null;
  surname: string | null;
  epithet: string | null;
  display_name?: string | null;
};

export type DatedPerson = {
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  death_date: string | null;
  death_precision: DatePrecision | null;
  deceased: boolean | null;
};

/** « Antoine de Croÿ, le Grand » — or the name written for this language. */
export function personName(p: NamedPerson): string {
  if (p.display_name) return p.display_name;
  const name = [p.given_names, p.surname].filter(Boolean).join(" ").trim();
  if (!p.epithet) return name;
  return name ? `${name}, ${p.epithet}` : p.epithet;
}

/**
 * « 1360 – 1415 », « vers 1360 – 1415 », « 1980 » (still alive),
 * « ? – 1415 ». Empty when nothing is known.
 */
export function lifespan(p: DatedPerson, locale: string): string {
  const birth =
    p.birth_date && p.birth_precision
      ? formatFuzzyDate(
          { date: p.birth_date, precision: p.birth_precision },
          locale,
        )
      : null;
  const death =
    p.death_date && p.death_precision
      ? formatFuzzyDate(
          { date: p.death_date, precision: p.death_precision },
          locale,
        )
      : null;
  if (death) return `${birth ?? "?"} – ${death}`;
  if (birth) return p.deceased ? `${birth} – ?` : birth;
  return "";
}

/** Short form for tight spaces: years only. */
export function lifespanYears(p: DatedPerson): string {
  const year = (d: string | null, precision: DatePrecision | null) => {
    if (!d) return null;
    const y = String(Number(d.slice(0, 4)));
    return precision === "about" ? `v. ${y}` : y;
  };
  const birth = year(p.birth_date, p.birth_precision);
  const death = year(p.death_date, p.death_precision);
  if (death) return `${birth ?? "?"} – ${death}`;
  if (birth) return p.deceased ? `${birth} – ?` : birth;
  return "";
}
