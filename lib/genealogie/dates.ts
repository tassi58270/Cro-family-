/**
 * Imprecise dates, as genealogy needs them (cahier des charges, section 5):
 * a year alone, « vers », « avant », « après ». Stored as an ISO date plus a
 * precision, the same pair as in the database.
 */

export type DatePrecision =
  "day" | "month" | "year" | "about" | "before" | "after";

export type FuzzyDate = { date: string; precision: DatePrecision };

const MONTHS: Record<string, number> = {
  // French
  janvier: 1,
  janv: 1,
  fevrier: 2,
  fevr: 2,
  fev: 2,
  mars: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  septembre: 9,
  sept: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  dec: 12,
  // English
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  october: 10,
  november: 11,
  december: 12,
  // German
  januar: 1,
  februar: 2,
  marz: 3,
  maerz: 3,
  juni: 6,
  juli: 7,
  oktober: 10,
  dezember: 12,
  dez: 12,
  okt: 10,
  mrz: 3,
};

// Whole words are followed by a space; abbreviations end with a dot.
const QUALIFIERS: [RegExp, DatePrecision][] = [
  [
    /^(?:(?:vers|environ|env|about|abt|approx|circa|ca|um|est|cal)\s+|(?:v|env|abt|approx|ca|c|est|cal)\.\s*)/,
    "about",
  ],
  [/^(?:(?:avant|before|bef|vor)\s+|(?:av|bef)\.\s*)/, "before"],
  [/^(?:(?:apres|after|aft|nach)\s+|(?:ap|aft)\.\s*)/, "after"],
];

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

function isValidDay(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month = 1, day = 1) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads what a person types, in French, English or German:
 * « 1890 », « vers 1890 », « avant 1700 », « mars 1890 », « 12 mars 1890 »,
 * « 12/03/1890 », « 1890-03-12 », « about 1890 », « um 1890 »…
 * Returns null when the text cannot be understood.
 */
export function parseFuzzyDate(input: string): FuzzyDate | null {
  let text = normalize(input);
  if (!text) return null;

  let qualifier: DatePrecision | null = null;
  for (const [pattern, precision] of QUALIFIERS) {
    if (pattern.test(text)) {
      qualifier = precision;
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  const exact = parseExact(text);
  if (!exact) return null;
  if (!qualifier) return exact;
  // A qualifier applies to the year: « vers mars 1890 » becomes « vers 1890 ».
  return { date: iso(Number(exact.date.slice(0, 4))), precision: qualifier };
}

function parseExact(text: string): FuzzyDate | null {
  let m: RegExpMatchArray | null;

  // 1890
  if ((m = text.match(/^(\d{3,4})$/))) {
    return { date: iso(Number(m[1])), precision: "year" };
  }
  // 1890-03-12 or 1890-03
  if ((m = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) {
    const [year, month, day] = [
      Number(m[1]),
      Number(m[2]),
      m[3] && Number(m[3]),
    ];
    if (day)
      return isValidDay(year, month, day)
        ? { date: iso(year, month, day), precision: "day" }
        : null;
    return month >= 1 && month <= 12
      ? { date: iso(year, month), precision: "month" }
      : null;
  }
  // 12/03/1890, 12.03.1890 (day first, as in French and German)
  if ((m = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{3,4})$/))) {
    const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidDay(year, month, day)
      ? { date: iso(year, month, day), precision: "day" }
      : null;
  }
  // 03/1890
  if ((m = text.match(/^(\d{1,2})[/.](\d{3,4})$/))) {
    const [month, year] = [Number(m[1]), Number(m[2])];
    return month >= 1 && month <= 12
      ? { date: iso(year, month), precision: "month" }
      : null;
  }
  // 12 mars 1890, 1er mars 1890, 12. März 1890, mars 1890, MAR 1890
  if (
    (m = text.match(/^(?:(\d{1,2})(?:er|\.)?\s+)?([a-z]+)\.?\s+(\d{3,4})$/))
  ) {
    const month = MONTHS[m[2]];
    if (!month) return null;
    const year = Number(m[3]);
    if (!m[1]) return { date: iso(year, month), precision: "month" };
    const day = Number(m[1]);
    return isValidDay(year, month, day)
      ? { date: iso(year, month, day), precision: "day" }
      : null;
  }
  return null;
}

const GEDCOM_MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 * Reads a GEDCOM date: « 12 MAR 1450 », « ABT 1385 », « BEF 1400 »,
 * « BET 1380 AND 1390 » (kept as « vers » the first year), « FROM 1400 TO
 * 1410 » (the first date). Other calendars and free text are refused.
 */
export function parseGedcomDate(input: string): FuzzyDate | null {
  const text = input.trim().toUpperCase();
  if (!text || text.startsWith("@#") || text.startsWith("(")) return null;

  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+.+$/))) {
    const first = parseGedcomExact(m[1]);
    return (
      first && { date: first.date.slice(0, 4) + "-01-01", precision: "about" }
    );
  }
  if ((m = text.match(/^(ABT|EST|CAL|BEF|AFT|FROM|TO)\s+(.+)$/))) {
    const exact = parseGedcomExact(m[2]);
    if (!exact) return null;
    if (m[1] === "FROM" || m[1] === "TO") return exact;
    const precision: DatePrecision =
      m[1] === "BEF" ? "before" : m[1] === "AFT" ? "after" : "about";
    return { date: exact.date.slice(0, 4) + "-01-01", precision };
  }
  return parseGedcomExact(text);
}

function parseGedcomExact(text: string): FuzzyDate | null {
  const m = text.match(/^(?:(\d{1,2})\s+)?(?:([A-Z]{3})\s+)?(\d{3,4})$/);
  if (!m) return null;
  const year = Number(m[3]);
  if (!m[2]) return m[1] ? null : { date: iso(year), precision: "year" };
  const month = GEDCOM_MONTHS.indexOf(m[2]) + 1;
  if (!month) return null;
  if (!m[1]) return { date: iso(year, month), precision: "month" };
  const day = Number(m[1]);
  return isValidDay(year, month, day)
    ? { date: iso(year, month, day), precision: "day" }
    : null;
}

/** Writes a date back as GEDCOM, for exports. */
export function toGedcomDate({ date, precision }: FuzzyDate): string {
  const [year, month, day] = date.split("-").map(Number);
  const mon = GEDCOM_MONTHS[month - 1];
  switch (precision) {
    case "day":
      return `${day} ${mon} ${year}`;
    case "month":
      return `${mon} ${year}`;
    case "about":
      return `ABT ${year}`;
    case "before":
      return `BEF ${year}`;
    case "after":
      return `AFT ${year}`;
    default:
      return String(year);
  }
}

const QUALIFIER_WORDS: Record<
  string,
  Partial<Record<DatePrecision, string>>
> = {
  fr: { about: "vers", before: "avant", after: "après" },
  en: { about: "c.", before: "before", after: "after" },
  de: { about: "um", before: "vor", after: "nach" },
};

/**
 * Shows a date in the visitor's language: « 12 mars 1890 », « mars 1890 »,
 * « vers 1890 ». Years are written without a thousands separator.
 */
export function formatFuzzyDate(value: FuzzyDate, locale: string): string {
  const [year, month, day] = value.date.split("-").map(Number);
  const yearText = String(year);
  const words = QUALIFIER_WORDS[locale] ?? QUALIFIER_WORDS.fr;
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2000, m - 1, 1)),
    );
  switch (value.precision) {
    case "day": {
      const dayText =
        locale === "fr" && day === 1
          ? "1er"
          : locale === "de"
            ? `${day}.`
            : String(day);
      return `${dayText} ${monthName(month)} ${yearText}`;
    }
    case "month":
      return `${monthName(month)} ${yearText}`;
    case "year":
      return yearText;
    default:
      return `${words[value.precision]} ${yearText}`;
  }
}

/** The year, for timelines and sorting. */
export function yearOf(value: FuzzyDate | null | undefined): number | null {
  return value ? Number(value.date.slice(0, 4)) : null;
}
