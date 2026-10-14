/**
 * What a member can propose (6.7), shared by the form, the server and the
 * dashboard. Photos and stories have their own forms; the guided form leads
 * to them.
 */

export const PROPOSAL_KINDS = [
  "correction",
  "person",
  "photo",
  "story",
  "place",
  "event",
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

/** Kinds saved as a suggestion; « photo » and « story » open their own forms. */
export const SUGGESTION_KINDS = [
  "correction",
  "person",
  "place",
  "event",
  "claim",
] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const RELATIONS = ["parent", "child", "spouse", "sibling"] as const;
export type Relation = (typeof RELATIONS)[number];

export type ProposalPayload = {
  text?: string;
  givenNames?: string;
  surname?: string;
  birth?: string;
  birthPlace?: string;
  death?: string;
  deathPlace?: string;
  relation?: Relation;
  name?: string;
  location?: string;
  title?: string;
  date?: string;
  place?: string;
};

/** The fields of each kind, in the order the form shows them. */
export const FIELDS: Record<SuggestionKind, (keyof ProposalPayload)[]> = {
  correction: ["text"],
  person: [
    "relation",
    "givenNames",
    "surname",
    "birth",
    "birthPlace",
    "death",
    "deathPlace",
    "text",
  ],
  place: ["name", "location", "text"],
  event: ["title", "date", "place", "text"],
  claim: ["text"],
};

const LIMITS: Partial<Record<keyof ProposalPayload, number>> = {
  text: 6000,
};

/** The payload of a kind, cleaned; null when what is required is missing. */
export function readPayload(
  kind: SuggestionKind,
  value: (field: string) => string,
): ProposalPayload | null {
  const payload: ProposalPayload = {};
  for (const field of FIELDS[kind]) {
    const raw = value(field)
      .trim()
      .slice(0, LIMITS[field] ?? 300);
    if (!raw) continue;
    if (field === "relation") {
      if ((RELATIONS as readonly string[]).includes(raw))
        payload.relation = raw as Relation;
      continue;
    }
    payload[field] = raw as never;
  }
  const required: Record<SuggestionKind, boolean> = {
    correction: Boolean(payload.text),
    person: Boolean(payload.givenNames || payload.surname),
    place: Boolean(payload.name),
    event: Boolean(payload.title),
    claim: true,
  };
  return required[kind] ? payload : null;
}

/** One line to name a proposal in a list or an email. */
export function summarize(kind: string, payload: ProposalPayload): string {
  const first = (text?: string) => {
    const flat = (text ?? "").replace(/\s+/g, " ").trim();
    return flat.length > 120
      ? `${flat.slice(0, 117).replace(/\s+\S*$/, "")}…`
      : flat;
  };
  switch (kind) {
    case "person":
      return [payload.givenNames, payload.surname].filter(Boolean).join(" ");
    case "place":
      return payload.name ?? "";
    case "event":
      return [payload.title, payload.date].filter(Boolean).join(", ");
    default:
      return first(payload.text);
  }
}
