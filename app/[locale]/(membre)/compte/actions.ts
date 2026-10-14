"use server";

import { text } from "@/lib/admin/form";
import { getSession, viewerOf } from "@/lib/auth/session";
import { withViewer } from "@/lib/db";
import { routing } from "@/lib/i18n/routing";

export type ProfileState = {
  status: "idle" | "saved" | "error";
  savedAt?: number;
};

/** A member changes their own name and the language of their emails. */
export async function saveProfile(
  _previous: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const session = await getSession();
  if (!session) return { status: "error" };
  const name = text(form, "displayName").slice(0, 120) || null;
  const locale =
    routing.locales.find((l) => l === text(form, "language")) ?? session.locale;
  try {
    await withViewer(viewerOf(session), (q) =>
      q(
        "update public.profiles set display_name = $1, preferred_locale = $2 where id = $3",
        [name, locale, session.accountId],
      ),
    );
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}
