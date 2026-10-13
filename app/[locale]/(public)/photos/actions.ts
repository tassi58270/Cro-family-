"use server";

import { getSession, viewerOf } from "@/lib/auth/session";
import { withViewer } from "@/lib/db";

/**
 * What members do on a photo: name someone in it (« Qui est-ce ? ») or ask
 * for it to be taken down. Both go to the administrators as suggestions.
 */

export type PhotoRequestState = {
  status: "idle" | "sent" | "invalid" | "error";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "")
    .trim()
    .slice(0, 2000);
}

async function suggest(
  form: FormData,
  kind: "identification" | "removal",
  payload: Record<string, unknown>,
) {
  const session = await getSession();
  const media = text(form, "photo");
  if (!session || !UUID.test(media)) return { status: "error" } as const;
  try {
    await withViewer(viewerOf(session), (q) =>
      q(
        `insert into public.suggestions (author_id, kind, target_table, target_id, payload)
         values ($1, $2, 'media', $3, $4)`,
        [session.accountId, kind, media, JSON.stringify(payload)],
      ),
    );
    return { status: "sent" } as const;
  } catch (error) {
    console.error(error);
    return { status: "error" } as const;
  }
}

export async function proposeName(
  _previous: PhotoRequestState,
  form: FormData,
): Promise<PhotoRequestState> {
  const person = text(form, "person");
  const name = text(form, "name");
  if (!UUID.test(person) && !name) return { status: "invalid" };
  return suggest(form, "identification", {
    person_id: UUID.test(person) ? person : null,
    name: name || null,
    where: text(form, "where") || null,
  });
}

export async function requestRemoval(
  _previous: PhotoRequestState,
  form: FormData,
): Promise<PhotoRequestState> {
  return suggest(form, "removal", { reason: text(form, "reason") || null });
}
