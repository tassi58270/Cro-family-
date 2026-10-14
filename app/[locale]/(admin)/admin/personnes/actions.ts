"use server";

import { asAdmin, id, ids } from "@/lib/admin/form";

export type MergeState = { status: "idle" | "merged" | "error"; at?: number };

/** Keeps one person and folds the other into it (undoable from the journal). */
export async function mergePeople(
  _previous: MergeState,
  form: FormData,
): Promise<MergeState> {
  const keep = id(form, "keep");
  const others = ids(form, "people").filter((p) => p !== keep);
  if (!keep || !others.length) return { status: "error" };
  try {
    await asAdmin(async (q) => {
      for (const duplicate of others)
        await q("select public.merge_people($1, $2)", [keep, duplicate]);
    });
    return { status: "merged", at: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}
