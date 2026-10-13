/**
 * « Quel est le lien ? » (cahier des charges, 6.2): the path between two
 * people of the tree, and the relationship in plain words, in French,
 * English and German.
 */

export type Sex = "female" | "male" | "unknown";

export type FamilyGraph = {
  parentsOf: Map<string, string[]>;
  childrenOf: Map<string, string[]>;
  spousesOf: Map<string, string[]>;
  sexOf: Map<string, Sex>;
};

export type Relationship =
  | { kind: "self"; path: string[] }
  | {
      kind: "blood";
      path: string[];
      /** Generations from A, then from B, up to the common ancestor. */
      up: number;
      down: number;
      ancestor: string;
      half: boolean;
    }
  | {
      kind: "marriage";
      path: string[];
      steps: ("parent" | "child" | "spouse")[];
    }
  | { kind: "none"; path: [] };

/** Every ancestor of a person with the shortest distance and the way back. */
function ancestry(graph: FamilyGraph, start: string) {
  const depth = new Map<string, number>([[start, 0]]);
  const via = new Map<string, string>();
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const parent of graph.parentsOf.get(id) ?? []) {
      if (depth.has(parent)) continue;
      depth.set(parent, depth.get(id)! + 1);
      via.set(parent, id);
      queue.push(parent);
    }
  }
  return { depth, via };
}

function climb(via: Map<string, string>, from: string, to: string) {
  // From the ancestor `from` back down to `to`.
  const path = [from];
  let current = from;
  while (current !== to) {
    current = via.get(current)!;
    path.push(current);
  }
  return path;
}

export function findRelationship(
  graph: FamilyGraph,
  a: string,
  b: string,
): Relationship {
  if (a === b) return { kind: "self", path: [a] };

  const ofA = ancestry(graph, a);
  const ofB = ancestry(graph, b);
  let best: { id: string; up: number; down: number } | null = null;
  for (const [id, up] of ofA.depth) {
    const down = ofB.depth.get(id);
    if (down === undefined) continue;
    const better =
      !best ||
      up + down < best.up + best.down ||
      (up + down === best.up + best.down &&
        Math.max(up, down) < Math.max(best.up, best.down));
    if (better) best = { id, up, down };
  }

  if (best) {
    const fromA = climb(ofA.via, best.id, a).reverse();
    const toB = climb(ofB.via, best.id, b);
    let half = false;
    if (best.up === 1 && best.down === 1) {
      const pa = new Set(graph.parentsOf.get(a) ?? []);
      const shared = (graph.parentsOf.get(b) ?? []).filter((p) =>
        pa.has(p),
      ).length;
      half =
        shared === 1 &&
        pa.size > 1 &&
        (graph.parentsOf.get(b) ?? []).length > 1;
    }
    return {
      kind: "blood",
      path: [...fromA, ...toB.slice(1)],
      up: best.up,
      down: best.down,
      ancestor: best.id,
      half,
    };
  }

  // No common ancestor: look for the shortest chain through marriages.
  const previous = new Map<
    string,
    { from: string; step: "parent" | "child" | "spouse" }
  >();
  const seen = new Set([a]);
  const queue = [a];
  while (queue.length && !seen.has(b)) {
    const id = queue.shift()!;
    const edges: [string, "parent" | "child" | "spouse"][] = [
      ...(graph.parentsOf.get(id) ?? []).map(
        (x) => [x, "parent"] as [string, "parent"],
      ),
      ...(graph.childrenOf.get(id) ?? []).map(
        (x) => [x, "child"] as [string, "child"],
      ),
      ...(graph.spousesOf.get(id) ?? []).map(
        (x) => [x, "spouse"] as [string, "spouse"],
      ),
    ];
    for (const [next, step] of edges) {
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, { from: id, step });
      queue.push(next);
    }
  }
  if (!seen.has(b)) return { kind: "none", path: [] };
  const path = [b];
  const steps: ("parent" | "child" | "spouse")[] = [];
  for (let id = b; id !== a;) {
    const p = previous.get(id)!;
    steps.unshift(p.step);
    path.unshift(p.from);
    id = p.from;
  }
  return { kind: "marriage", path, steps };
}

type Gendered = [male: string, female: string, neutral: string];

function pickSex([male, female, neutral]: Gendered, sex: Sex) {
  return sex === "male" ? male : sex === "female" ? female : neutral;
}

const FR = {
  self: "la même personne",
  none: "sans lien connu",
  child: ["fils", "fille", "enfant"] as Gendered,
  grandchild: ["petit-fils", "petite-fille", "petit-enfant"] as Gendered,
  parent: ["père", "mère", "parent"] as Gendered,
  grandparent: ["grand-père", "grand-mère", "grand-parent"] as Gendered,
  sibling: ["frère", "sœur", "frère ou sœur"] as Gendered,
  halfSibling: [
    "demi-frère",
    "demi-sœur",
    "demi-frère ou demi-sœur",
  ] as Gendered,
  nephew: ["neveu", "nièce", "neveu ou nièce"] as Gendered,
  uncle: ["oncle", "tante", "oncle ou tante"] as Gendered,
  cousin: ["cousin", "cousine", "cousin ou cousine"] as Gendered,
  spouse: ["époux", "épouse", "conjoint"] as Gendered,
  parentInLaw: ["beau-père", "belle-mère", "beau-parent"] as Gendered,
  childInLaw: ["gendre", "belle-fille", "gendre ou belle-fille"] as Gendered,
  siblingInLaw: [
    "beau-frère",
    "belle-sœur",
    "beau-frère ou belle-sœur",
  ] as Gendered,
  inLaw: "parent par alliance",
};

function frGreat(n: number) {
  return "arrière-".repeat(Math.max(0, n));
}

function french(rel: Relationship, sex: Sex): string {
  if (rel.kind === "self") return FR.self;
  if (rel.kind === "none") return FR.none;
  if (rel.kind === "marriage") return marriageLabel(rel, sex, FR);
  const { up, down, half } = rel;
  const female = sex === "female";
  if (up === 0) {
    if (down === 1) return pickSex(FR.child, sex);
    if (down <= 5) return frGreat(down - 2) + pickSex(FR.grandchild, sex);
    return `${female ? "descendante" : "descendant"} à la ${down}e génération`;
  }
  if (down === 0) {
    if (up === 1) return pickSex(FR.parent, sex);
    if (up <= 5) return frGreat(up - 2) + pickSex(FR.grandparent, sex);
    return `${female ? "ancêtre" : "ancêtre"} à la ${up}e génération`;
  }
  if (up === 1 && down === 1)
    return pickSex(half ? FR.halfSibling : FR.sibling, sex);
  if (up === 1) {
    const base = pickSex(FR.nephew, sex);
    if (down === 2) return base;
    return frGreat(down - 3) + (female ? "petite-" : "petit-") + base;
  }
  if (down === 1) {
    const base = pickSex(FR.uncle, sex);
    if (up === 2) return base;
    return frGreat(up - 3) + (female ? "grand-" : "grand-") + base;
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const word = pickSex(FR.cousin, sex);
  const name =
    degree === 1
      ? `${word} ${female ? "germaine" : "germain"}`
      : degree === 2
        ? `${word} ${female ? "issue" : "issu"} de germain`
        : `${word} au ${degree + 1}e degré`;
  if (!removed) return name;
  return `${name}, ${removed === 1 ? "une génération" : `${removed} générations`} d’écart`;
}

const EN = {
  self: "the same person",
  none: "not known to be related",
  child: ["son", "daughter", "child"] as Gendered,
  grandchild: ["grandson", "granddaughter", "grandchild"] as Gendered,
  parent: ["father", "mother", "parent"] as Gendered,
  grandparent: ["grandfather", "grandmother", "grandparent"] as Gendered,
  sibling: ["brother", "sister", "sibling"] as Gendered,
  halfSibling: ["half-brother", "half-sister", "half-sibling"] as Gendered,
  nephew: ["nephew", "niece", "nephew or niece"] as Gendered,
  uncle: ["uncle", "aunt", "uncle or aunt"] as Gendered,
  cousin: ["cousin", "cousin", "cousin"] as Gendered,
  spouse: ["husband", "wife", "spouse"] as Gendered,
  parentInLaw: ["father-in-law", "mother-in-law", "parent-in-law"] as Gendered,
  childInLaw: ["son-in-law", "daughter-in-law", "child-in-law"] as Gendered,
  siblingInLaw: [
    "brother-in-law",
    "sister-in-law",
    "sibling-in-law",
  ] as Gendered,
  inLaw: "related by marriage",
};

const ORDINALS_EN = [
  "",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
];

function english(rel: Relationship, sex: Sex): string {
  if (rel.kind === "self") return EN.self;
  if (rel.kind === "none") return EN.none;
  if (rel.kind === "marriage") return marriageLabel(rel, sex, EN);
  const { up, down, half } = rel;
  const great = (n: number) => "great-".repeat(Math.max(0, n));
  if (up === 0) {
    if (down === 1) return pickSex(EN.child, sex);
    return great(down - 2) + pickSex(EN.grandchild, sex);
  }
  if (down === 0) {
    if (up === 1) return pickSex(EN.parent, sex);
    return great(up - 2) + pickSex(EN.grandparent, sex);
  }
  if (up === 1 && down === 1)
    return pickSex(half ? EN.halfSibling : EN.sibling, sex);
  if (up === 1) return great(down - 2) + pickSex(EN.nephew, sex);
  if (down === 1) return great(up - 2) + pickSex(EN.uncle, sex);
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const ordinal = ORDINALS_EN[degree] ?? `${degree}th`;
  const times =
    removed === 1 ? "once" : removed === 2 ? "twice" : `${removed} times`;
  return `${ordinal} cousin${removed ? ` ${times} removed` : ""}`;
}

const DE = {
  self: "dieselbe Person",
  none: "keine bekannte Verwandtschaft",
  child: ["Sohn", "Tochter", "Kind"] as Gendered,
  grandchild: ["Enkel", "Enkelin", "Enkelkind"] as Gendered,
  parent: ["Vater", "Mutter", "Elternteil"] as Gendered,
  grandparent: ["Großvater", "Großmutter", "Großelternteil"] as Gendered,
  sibling: ["Bruder", "Schwester", "Geschwister"] as Gendered,
  halfSibling: ["Halbbruder", "Halbschwester", "Halbgeschwister"] as Gendered,
  nephew: ["Neffe", "Nichte", "Neffe oder Nichte"] as Gendered,
  uncle: ["Onkel", "Tante", "Onkel oder Tante"] as Gendered,
  cousin: ["Cousin", "Cousine", "Cousin oder Cousine"] as Gendered,
  spouse: ["Ehemann", "Ehefrau", "Ehepartner"] as Gendered,
  parentInLaw: [
    "Schwiegervater",
    "Schwiegermutter",
    "Schwiegerelternteil",
  ] as Gendered,
  childInLaw: [
    "Schwiegersohn",
    "Schwiegertochter",
    "Schwiegerkind",
  ] as Gendered,
  siblingInLaw: [
    "Schwager",
    "Schwägerin",
    "Schwager oder Schwägerin",
  ] as Gendered,
  inLaw: "verschwägert",
};

const ORDINALS_DE = [
  "",
  "ersten",
  "zweiten",
  "dritten",
  "vierten",
  "fünften",
  "sechsten",
];

function german(rel: Relationship, sex: Sex): string {
  if (rel.kind === "self") return DE.self;
  if (rel.kind === "none") return DE.none;
  if (rel.kind === "marriage") return marriageLabel(rel, sex, DE);
  const { up, down, half } = rel;
  const ur = (n: number) => "Ur".repeat(Math.max(0, n));
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  if (up === 0) {
    if (down === 1) return pickSex(DE.child, sex);
    const word = pickSex(DE.grandchild, sex);
    return down === 2 ? word : ur(down - 2) + lower(word);
  }
  if (down === 0) {
    if (up === 1) return pickSex(DE.parent, sex);
    const word = pickSex(DE.grandparent, sex);
    return up === 2 ? word : ur(up - 2) + lower(word);
  }
  if (up === 1 && down === 1)
    return pickSex(half ? DE.halfSibling : DE.sibling, sex);
  if (up === 1) {
    const word = pickSex(DE.nephew, sex);
    if (down === 2) return word;
    return (down === 3 ? "Groß" : ur(down - 3) + "groß") + lower(word);
  }
  if (down === 1) {
    const word = pickSex(DE.uncle, sex);
    if (up === 2) return word;
    return (up === 3 ? "Groß" : ur(up - 3) + "groß") + lower(word);
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const name = `${pickSex(DE.cousin, sex)} ${ORDINALS_DE[degree] ?? `${degree}.`} Grades`;
  if (!removed) return name;
  return `${name}, ${removed === 1 ? "eine Generation" : `${removed} Generationen`} versetzt`;
}

function marriageLabel(
  rel: Extract<Relationship, { kind: "marriage" }>,
  sex: Sex,
  words: typeof FR,
): string {
  const s = rel.steps.join(">");
  if (s === "spouse") return pickSex(words.spouse, sex);
  if (s === "spouse>parent") return pickSex(words.parentInLaw, sex);
  if (s === "child>spouse") return pickSex(words.childInLaw, sex);
  if (s === "spouse>parent>child" || s === "parent>child>spouse") {
    return pickSex(words.siblingInLaw, sex);
  }
  return words.inLaw;
}

/** « arrière-petit-neveu »: what B is to A, for B of the given sex. */
export function relationshipLabel(
  rel: Relationship,
  sex: Sex,
  locale: string,
): string {
  if (locale === "en") return english(rel, sex);
  if (locale === "de") return german(rel, sex);
  return french(rel, sex);
}
