import "server-only";
import type { Query } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import { routing, type Locale } from "@/lib/i18n/routing";
import type { Certainty } from "./person";

/**
 * What the dashboard shows of the tree's entry points and of the lineages
 * to demonstrate, link by link with their certainty and proofs.
 */

type PersonRef = { id: string; name: string; years: string };

export type AdminEntryPoint = {
  id: string;
  person: PersonRef;
  labels: Record<Locale, string>;
  isDefault: boolean;
  isDemo: boolean;
};

export type AdminLineageStep = {
  parent: PersonRef;
  child: PersonRef;
  certainty: Certainty;
  sources: {
    id: string;
    title: string;
    kind: string;
    reference: string | null;
  }[];
};

export type AdminLineage = {
  id: string;
  start: PersonRef;
  end: PersonRef;
  titles: Record<Locale, string>;
  intros: Record<Locale, string>;
  isDemo: boolean;
  /** Null when no line of descent joins the two people yet. */
  steps: AdminLineageStep[] | null;
};

type PersonRow = {
  id: string;
  given_names: string | null;
  surname: string | null;
  epithet: string | null;
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  death_date: string | null;
  death_precision: DatePrecision | null;
  deceased: boolean | null;
};

const empty = () =>
  Object.fromEntries(routing.locales.map((l) => [l, ""])) as Record<
    Locale,
    string
  >;

export async function loadTreeSettings(q: Query) {
  const people = await q<PersonRow>(
    `select id, given_names, surname, epithet, birth_date, birth_precision,
            death_date, death_precision, deceased
     from public.people`,
  );
  const byId = new Map(people.map((p) => [p.id, p]));
  const ref = (id: string): PersonRef => {
    const p = byId.get(id);
    return p
      ? { id, name: personName(p), years: lifespanYears(p) }
      : { id, name: "?", years: "" };
  };

  const entryRows = await q<{
    id: string;
    person_id: string;
    is_default: boolean;
    is_demo: boolean;
  }>(
    "select id, person_id, is_default, is_demo from public.tree_entry_points order by sort_order, created_at",
  );
  const entryLabels = await q<{
    entry_id: string;
    locale: Locale;
    label: string;
  }>("select entry_id, locale, label from public.tree_entry_points_i18n");
  const entries: AdminEntryPoint[] = entryRows.map((e) => {
    const labels = empty();
    for (const l of entryLabels.filter((x) => x.entry_id === e.id))
      labels[l.locale] = l.label;
    return {
      id: e.id,
      person: ref(e.person_id),
      labels,
      isDefault: e.is_default,
      isDemo: e.is_demo,
    };
  });

  const lineageRows = await q<{
    id: string;
    start_person_id: string;
    end_person_id: string;
    is_demo: boolean;
  }>(
    "select id, start_person_id, end_person_id, is_demo from public.lineages order by sort_order, created_at",
  );
  const lineageTexts = await q<{
    lineage_id: string;
    locale: Locale;
    title: string;
    intro: string | null;
  }>("select lineage_id, locale, title, intro from public.lineages_i18n");
  const links = await q<{
    parent_id: string;
    child_id: string;
    certainty: Certainty;
  }>("select parent_id, child_id, certainty from public.parent_child");
  const proofs = await q<{
    id: string;
    title: string;
    kind: string;
    reference: string | null;
    parent_id: string;
    child_id: string;
  }>(
    `select s.id, s.title, s.kind, s.reference, fs.parent_id, fs.child_id
     from public.filiation_sources fs join public.sources s on s.id = fs.source_id
     order by s.created_at`,
  );
  const childrenOf = new Map<
    string,
    { child: string; certainty: Certainty }[]
  >();
  for (const l of links) {
    const list = childrenOf.get(l.parent_id) ?? [];
    list.push({ child: l.child_id, certainty: l.certainty });
    childrenOf.set(l.parent_id, list);
  }

  const lineages: AdminLineage[] = lineageRows.map((l) => {
    const titles = empty();
    const intros = empty();
    for (const x of lineageTexts.filter((t) => t.lineage_id === l.id)) {
      titles[x.locale] = x.title;
      intros[x.locale] = x.intro ?? "";
    }
    // Shortest line of descent from the first person to the last.
    const previous = new Map<
      string,
      { parent: string; certainty: Certainty }
    >();
    const queue = [l.start_person_id];
    const seen = new Set(queue);
    while (queue.length && !seen.has(l.end_person_id)) {
      const id = queue.shift()!;
      for (const { child, certainty } of childrenOf.get(id) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        previous.set(child, { parent: id, certainty });
        queue.push(child);
      }
    }
    let steps: AdminLineageStep[] | null = null;
    if (seen.has(l.end_person_id)) {
      steps = [];
      for (let id = l.end_person_id; id !== l.start_person_id;) {
        const p = previous.get(id)!;
        const child = id;
        steps.unshift({
          parent: ref(p.parent),
          child: ref(child),
          certainty: p.certainty,
          sources: proofs
            .filter((s) => s.parent_id === p.parent && s.child_id === child)
            .map(({ id: sourceId, title, kind, reference }) => ({
              id: sourceId,
              title,
              kind,
              reference,
            })),
        });
        id = p.parent;
      }
    }
    return {
      id: l.id,
      start: ref(l.start_person_id),
      end: ref(l.end_person_id),
      titles,
      intros,
      isDemo: l.is_demo,
      steps,
    };
  });

  return { entries, lineages };
}
