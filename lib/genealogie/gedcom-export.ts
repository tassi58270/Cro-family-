import { toGedcomDate, type FuzzyDate } from "./dates";

/**
 * Writing the tree as GEDCOM 5.5.1 (section 5: « Import et export GEDCOM »),
 * readable by every genealogy program, and by our own import.
 */

export type ExportPerson = {
  id: string;
  givenNames: string | null;
  surname: string | null;
  epithet: string | null;
  sex: "female" | "male" | "unknown";
  birth: FuzzyDate | null;
  birthPlace: string | null;
  death: FuzzyDate | null;
  deathPlace: string | null;
  deceased: boolean;
};

export type ExportUnion = {
  id: string;
  a: string;
  b: string | null;
  marriage: FuzzyDate | null;
  marriagePlace: string | null;
};

export type ExportTree = {
  people: ExportPerson[];
  unions: ExportUnion[];
  filiations: { parent: string; child: string }[];
};

/** GEDCOM values are one line each: no line breaks, no « @ » alone. */
function clean(value: string) {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/@/g, "@@")
    .trim();
}

function event(tag: string, date: FuzzyDate | null, place: string | null) {
  if (!date && !place) return [];
  return [
    `1 ${tag}`,
    ...(date ? [`2 DATE ${toGedcomDate(date)}`] : []),
    ...(place ? [`2 PLAC ${clean(place)}`] : []),
  ];
}

export function buildGedcom(tree: ExportTree, today = new Date()): string {
  const indi = new Map(tree.people.map((p, i) => [p.id, `@I${i + 1}@`]));
  const sex = new Map(tree.people.map((p) => [p.id, p.sex]));

  // A family per union, plus one per parent (or pair of parents) without a
  // recorded union, so that every child keeps its parents.
  type Family = {
    partners: string[];
    children: string[];
    marriage: FuzzyDate | null;
    marriagePlace: string | null;
  };
  const families = new Map<string, Family>();
  const keyOf = (ids: string[]) => [...ids].sort().join("+");
  for (const u of tree.unions) {
    const partners = [u.a, u.b].filter((p): p is string => Boolean(p));
    families.set(keyOf(partners), {
      partners,
      children: [],
      marriage: u.marriage,
      marriagePlace: u.marriagePlace,
    });
  }
  const parents = new Map<string, string[]>();
  for (const f of tree.filiations)
    parents.set(f.child, [...(parents.get(f.child) ?? []), f.parent]);
  for (const [child, ids] of parents) {
    const known = ids.filter((id) => indi.has(id)).slice(0, 2);
    if (!known.length || !indi.has(child)) continue;
    const key = keyOf(known);
    const family = families.get(key) ?? {
      partners: known,
      children: [],
      marriage: null,
      marriagePlace: null,
    };
    family.children.push(child);
    families.set(key, family);
  }

  const fams = [...families.values()].filter((f) =>
    f.partners.every((p) => indi.has(p)),
  );
  const famOf = new Map(fams.map((f, i) => [f, `@F${i + 1}@`]));
  const spouseIn = new Map<string, string[]>();
  const childIn = new Map<string, string[]>();
  for (const f of fams) {
    for (const p of f.partners)
      spouseIn.set(p, [...(spouseIn.get(p) ?? []), famOf.get(f)!]);
    for (const c of f.children)
      childIn.set(c, [...(childIn.get(c) ?? []), famOf.get(f)!]);
  }

  const date = `${today.getUTCDate()} ${
    [
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
    ][today.getUTCMonth()]
  } ${today.getUTCFullYear()}`;
  const lines = [
    "0 HEAD",
    "1 SOUR MAISON_DE_CROY",
    "2 NAME Site de la maison de Croÿ",
    `1 DATE ${date}`,
    "1 GEDC",
    "2 VERS 5.5.1",
    "2 FORM LINEAGE-LINKED",
    "1 CHAR UTF-8",
  ];
  for (const p of tree.people) {
    const given = clean(p.givenNames ?? "");
    const surname = clean(p.surname ?? "");
    lines.push(`0 ${indi.get(p.id)} INDI`);
    lines.push(
      `1 NAME ${[given, surname ? `/${surname}/` : ""].filter(Boolean).join(" ")}`,
    );
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
    if (p.epithet) lines.push(`2 NICK ${clean(p.epithet)}`);
    if (p.sex !== "unknown")
      lines.push(`1 SEX ${p.sex === "male" ? "M" : "F"}`);
    lines.push(...event("BIRT", p.birth, p.birthPlace));
    const death = event("DEAT", p.death, p.deathPlace);
    if (death.length) lines.push(...death);
    else if (p.deceased) lines.push("1 DEAT Y");
    for (const f of spouseIn.get(p.id) ?? []) lines.push(`1 FAMS ${f}`);
    for (const f of childIn.get(p.id) ?? []) lines.push(`1 FAMC ${f}`);
  }
  for (const f of fams) {
    lines.push(`0 ${famOf.get(f)} FAM`);
    const [first, second] = f.partners;
    // HUSB and WIFE from the recorded sex; otherwise in the order given.
    const husband = sex.get(first) === "female" && second ? second : first;
    const wife = husband === first ? second : first;
    if (husband)
      lines.push(
        `1 ${sex.get(husband) === "female" ? "WIFE" : "HUSB"} ${indi.get(husband)}`,
      );
    if (wife)
      lines.push(
        `1 ${sex.get(wife) === "male" ? "HUSB" : "WIFE"} ${indi.get(wife)}`,
      );
    for (const c of f.children) lines.push(`1 CHIL ${indi.get(c)}`);
    lines.push(...event("MARR", f.marriage, f.marriagePlace));
  }
  lines.push("0 TRLR");
  return `${lines.join("\r\n")}\r\n`;
}

/** A CSV cell: quoted when it holds a separator, a quote or a line break. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with « ; » (opens directly in a French spreadsheet), BOM included. */
export function toCsv(columns: string[], rows: Record<string, unknown>[]) {
  const lines = [
    columns.join(";"),
    ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
