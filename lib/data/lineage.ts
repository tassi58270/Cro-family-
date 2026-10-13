import "server-only";
import { hasDatabase, withViewer, type Viewer } from "@/lib/db";
import type { Certainty, Source } from "./person";

export type LineageStep = {
  parentId: string;
  childId: string;
  certainty: Certainty;
  sources: Source[];
};

/**
 * « Voir la démonstration » (cahier des charges, 6.2): the line of descent
 * from the first person to the last, one parent-child link at a time, each
 * with its proofs. The path follows published links only.
 */
export async function loadLineage(
  viewer: Viewer,
  id: string,
): Promise<LineageStep[] | null> {
  if (!hasDatabase() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return withViewer(viewer, async (q) => {
    const [lineage] = await q<{
      start_person_id: string;
      end_person_id: string;
    }>(
      "select start_person_id, end_person_id from public.lineages where id = $1",
      [id],
    );
    if (!lineage) return null;
    const links = await q<{
      from_id: string;
      to_id: string;
      certainty: Certainty;
    }>(
      "select from_id, to_id, certainty from public.tree_links() where kind = 'parent'",
    );
    // Shortest path down from the start to the end.
    const previous = new Map<
      string,
      { parent: string; certainty: Certainty }
    >();
    const queue = [lineage.start_person_id];
    const seen = new Set(queue);
    while (queue.length && !seen.has(lineage.end_person_id)) {
      const id = queue.shift()!;
      for (const l of links) {
        if (l.from_id !== id || seen.has(l.to_id)) continue;
        seen.add(l.to_id);
        previous.set(l.to_id, { parent: id, certainty: l.certainty });
        queue.push(l.to_id);
      }
    }
    if (!seen.has(lineage.end_person_id)) return [];
    const steps: Omit<LineageStep, "sources">[] = [];
    for (let id = lineage.end_person_id; id !== lineage.start_person_id;) {
      const p = previous.get(id)!;
      steps.unshift({
        parentId: p.parent,
        childId: id,
        certainty: p.certainty,
      });
      id = p.parent;
    }
    const sources = await q<Source & { parent_id: string; child_id: string }>(
      `select s.id, s.kind, s.title, s.reference, s.repository, s.url, s.transcription,
              s.translation, fs.note, fs.parent_id, fs.child_id
       from public.filiation_sources fs join public.sources s on s.id = fs.source_id`,
    );
    return steps.map((step) => ({
      ...step,
      sources: sources
        .filter(
          (s) => s.parent_id === step.parentId && s.child_id === step.childId,
        )
        .map((s) => {
          const source: Source & { parent_id?: string; child_id?: string } = {
            ...s,
          };
          delete source.parent_id;
          delete source.child_id;
          return source;
        }),
    }));
  });
}
