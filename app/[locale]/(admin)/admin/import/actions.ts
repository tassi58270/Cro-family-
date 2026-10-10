"use server";

import { getSession, viewerOf } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer } from "@/lib/db";
import { decodeGedcom, parseGedcom } from "@/lib/genealogie/gedcom";
import {
  importGedcom,
  previewImport,
  type ImportPreview,
  type ImportResult,
} from "@/lib/genealogie/import";

const MAX_BYTES = 4 * 1024 * 1024;

export type ImportState =
  | { status: "idle" }
  | { status: "invalid"; reason: "missing" | "size" | "format" }
  | { status: "preview"; preview: ImportPreview; fileName: string }
  | { status: "done"; result: ImportResult }
  | { status: "error" };

async function readFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "missing" as const };
  if (file.size > MAX_BYTES) return { error: "size" as const };
  const text = decodeGedcom(new Uint8Array(await file.arrayBuffer()));
  if (!/^\s*0\s+HEAD/.test(text)) return { error: "format" as const };
  return { name: file.name, data: parseGedcom(text) };
}

/** First pass: what the file contains, before anything is written. */
export async function gedcomAction(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { status: "error" };

  const file = await readFile(form);
  if ("error" in file) return { status: "invalid", reason: file.error! };

  try {
    if (form.get("intent") !== "import") {
      const preview = await withViewer(viewerOf(session), (q) =>
        previewImport(q, file.data),
      );
      return { status: "preview", preview, fileName: file.name };
    }
    const result = await withViewer(viewerOf(session), (q) =>
      importGedcom(q, file.data, {
        published: form.get("published") === "on",
        reuseExisting: form.get("reuse") === "on",
        actor: session.accountId,
      }),
    );
    contentChanged();
    return { status: "done", result };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}
