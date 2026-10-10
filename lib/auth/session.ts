import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { hasDatabase, VISITOR, withSystem, type Viewer } from "@/lib/db";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { hashToken } from "./tokens";

/** httpOnly: holds the session token. */
export const SESSION_COOKIE = "croy_session";
/** Readable by the page: only says « someone is signed in », to adapt the menu. */
export const SIGNED_IN_COOKIE = "croy_membre";

export const SESSION_DAYS = 30;

export type Session = {
  accountId: string;
  email: string;
  role: "member" | "admin";
  displayName: string | null;
  personId: string | null;
  locale: Locale;
};

/** The signed-in account of this request, or null. Read once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!hasDatabase()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await withSystem((q) =>
    q<{
      id: string;
      email: string;
      role: Session["role"];
      display_name: string | null;
      person_id: string | null;
      preferred_locale: Locale;
      session_id: string;
      stale: boolean;
    }>(
      `select a.id, a.email, p.role, p.display_name, p.person_id, p.preferred_locale,
              s.id as session_id, s.last_seen_at < now() - interval '1 hour' as stale
       from private.sessions s
       join private.accounts a on a.id = s.account_id
       join public.profiles p on p.id = a.id
       where s.token_hash = $1 and s.expires_at > now() and p.disabled_at is null`,
      [hashToken(token)],
    ),
  );
  const row = rows[0];
  if (!row) return null;

  if (row.stale) {
    await withSystem((q) =>
      q(
        `update private.sessions
         set last_seen_at = now(), expires_at = now() + make_interval(days => $2)
         where id = $1`,
        [row.session_id, SESSION_DAYS],
      ),
    );
  }

  return {
    accountId: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    personId: row.person_id,
    locale: row.preferred_locale,
  };
});

/** Who the database should consider this request to come from. */
export async function currentViewer(): Promise<Viewer> {
  const session = await getSession();
  return session ? { kind: "account", id: session.accountId } : VISITOR;
}

export async function requireMember(locale: Locale): Promise<Session> {
  const session = await getSession();
  if (!session) redirect({ href: "/connexion", locale });
  return session!;
}

export async function requireAdmin(locale: Locale): Promise<Session> {
  const session = await requireMember(locale);
  if (session.role !== "admin") redirect({ href: "/compte", locale });
  return session;
}

/** The database viewer of a session, for withViewer(). */
export function viewerOf(session: Session): Viewer {
  return { kind: "account", id: session.accountId };
}
