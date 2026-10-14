"use server";

import { asAdmin, text } from "@/lib/admin/form";

export type UndoState = {
  status: "idle" | "done" | "later" | "error";
  at?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Undoes a whole change; refused when a later change touched the same rows. */
export async function undoChange(
  _previous: UndoState,
  form: FormData,
): Promise<UndoState> {
  const at = text(form, "at");
  const actor = text(form, "actor");
  if (!at || Number.isNaN(Date.parse(at))) return { status: "error" };
  try {
    await asAdmin((q) =>
      q("select public.undo_change($1::timestamptz, $2::uuid)", [
        at,
        UUID.test(actor) ? actor : null,
      ]),
    );
    return { status: "done", at };
  } catch (error) {
    const message = String((error as Error).message);
    if (message.includes("changed since")) return { status: "later", at };
    console.error(error);
    return { status: "error", at };
  }
}
