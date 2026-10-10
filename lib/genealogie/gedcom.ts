import { parseGedcomDate, type FuzzyDate } from "./dates";

/**
 * Reading GEDCOM files (5.5 and 5.5.1), the format every genealogy program
 * exports, so that the family tree can be loaded in one go (step 4).
 */

export type GedcomNode = {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  children: GedcomNode[];
};

export type GedcomEvent = {
  date: FuzzyDate | null;
  /** The date as written, kept when it could not be understood. */
  dateText: string;
  place: string;
};

export type GedcomPerson = {
  xref: string;
  givenNames: string;
  surname: string;
  epithet: string;
  sex: "female" | "male" | "unknown";
  birth: GedcomEvent | null;
  death: GedcomEvent | null;
  /** A death or burial is recorded, even without a date. */
  deceased: boolean;
  notes: number;
};

export type GedcomFamily = {
  xref: string;
  partners: string[];
  children: string[];
  marriage: GedcomEvent | null;
};

export type GedcomData = {
  people: GedcomPerson[];
  families: GedcomFamily[];
  warnings: { code: "date" | "notes" | "missing"; detail: string }[];
};

/** Decodes the bytes of a file, following its BOM or its CHAR header. */
export function decodeGedcom(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const charset =
    head.match(/^\s*1\s+CHAR\s+(\S+)/m)?.[1]?.toUpperCase() ?? "UTF-8";
  if (charset === "UTF-8" || charset === "UTF8" || charset === "UNICODE") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  // ANSI, IBMPC, and ANSEL read as Windows-1252: right for nearly every
  // accented letter used in French and German names.
  return new TextDecoder("windows-1252").decode(bytes);
}

/** Lines into a tree of records; CONC and CONT are joined to their parent. */
export function parseNodes(text: string): GedcomNode[] {
  const roots: GedcomNode[] = [];
  const stack: GedcomNode[] = [];

  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/^﻿/, "").trimStart();
    if (!line) continue;
    const m = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/);
    if (!m) continue;
    const node: GedcomNode = {
      level: Number(m[1]),
      xref: m[2],
      tag: m[3].toUpperCase(),
      value: m[4] ?? "",
      children: [],
    };
    while (stack.length && stack[stack.length - 1].level >= node.level)
      stack.pop();
    const parent = stack[stack.length - 1];

    if (parent && (node.tag === "CONC" || node.tag === "CONT")) {
      parent.value += (node.tag === "CONT" ? "\n" : "") + node.value;
      continue;
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

const child = (node: GedcomNode, tag: string) =>
  node.children.find((c) => c.tag === tag);
const childrenOf = (node: GedcomNode, tag: string) =>
  node.children.filter((c) => c.tag === tag);

function readEvent(
  node: GedcomNode | undefined,
  warnings: GedcomData["warnings"],
  who: string,
): GedcomEvent | null {
  if (!node) return null;
  const dateText = child(node, "DATE")?.value.trim() ?? "";
  const date = dateText ? parseGedcomDate(dateText) : null;
  if (dateText && !date)
    warnings.push({ code: "date", detail: `${who} : ${dateText}` });
  return { date, dateText, place: child(node, "PLAC")?.value.trim() ?? "" };
}

function readName(node: GedcomNode | undefined) {
  if (!node) return { givenNames: "", surname: "", epithet: "" };
  const value = node.value;
  const slash = value.match(/^(.*?)\/(.*?)\/(.*)$/);
  const givenNames = child(node, "GIVN")?.value ?? (slash ? slash[1] : value);
  const surname = child(node, "SURN")?.value ?? (slash ? slash[2] : "");
  const suffix = child(node, "NSFX")?.value ?? (slash ? slash[3] : "");
  const nickname = child(node, "NICK")?.value ?? "";
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  return {
    givenNames: clean(givenNames),
    surname: clean(surname),
    epithet: clean(nickname || suffix),
  };
}

export function parseGedcom(text: string): GedcomData {
  const roots = parseNodes(text);
  const warnings: GedcomData["warnings"] = [];
  const people: GedcomPerson[] = [];
  const families: GedcomFamily[] = [];
  let notes = 0;

  for (const record of roots) {
    if (record.tag === "INDI" && record.xref) {
      const name = readName(child(record, "NAME"));
      const who =
        [name.givenNames, name.surname].filter(Boolean).join(" ") ||
        record.xref;
      const sex = child(record, "SEX")?.value.trim().toUpperCase();
      const deathNode = child(record, "DEAT");
      const personNotes = childrenOf(record, "NOTE").length;
      notes += personNotes;
      people.push({
        xref: record.xref,
        ...name,
        sex: sex === "F" ? "female" : sex === "M" ? "male" : "unknown",
        birth: readEvent(
          child(record, "BIRT") ??
            child(record, "CHR") ??
            child(record, "BAPM"),
          warnings,
          who,
        ),
        death: readEvent(deathNode ?? child(record, "BURI"), warnings, who),
        deceased: Boolean(deathNode || child(record, "BURI")),
        notes: personNotes,
      });
    }
    if (record.tag === "FAM" && record.xref) {
      families.push({
        xref: record.xref,
        partners: [
          child(record, "HUSB")?.value,
          child(record, "WIFE")?.value,
        ].filter((v): v is string => Boolean(v)),
        children: childrenOf(record, "CHIL").map((c) => c.value),
        marriage: readEvent(child(record, "MARR"), warnings, record.xref),
      });
    }
  }

  const known = new Set(people.map((p) => p.xref));
  for (const family of families) {
    for (const ref of [...family.partners, ...family.children]) {
      if (!known.has(ref))
        warnings.push({ code: "missing", detail: `${family.xref} → ${ref}` });
    }
    family.partners = family.partners.filter((r) => known.has(r));
    family.children = family.children.filter((r) => known.has(r));
  }
  if (notes) warnings.push({ code: "notes", detail: String(notes) });

  return { people, families, warnings };
}
