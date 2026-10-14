"use server";

import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { mayAccess, roleFor } from "@/lib/auth/access";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  SIGNED_IN_COOKIE,
} from "@/lib/auth/session";
import {
  hashToken,
  isEmail,
  newToken,
  normalizeEmail,
} from "@/lib/auth/tokens";
import { hasDatabase, withSystem } from "@/lib/db";
import { deliveryMode, sendEmail, simpleEmail } from "@/lib/email";
import { getPathname, redirect } from "@/lib/i18n/navigation";
import { routing, type Locale } from "@/lib/i18n/routing";
import { siteUrl } from "@/lib/site";

const LINK_MINUTES = 20;
// Against abuse; end-to-end tests raise it with AUTH_LINKS_PER_HOUR.
const LINKS_PER_HOUR = Number(process.env.AUTH_LINKS_PER_HOUR ?? 5);

function localeOf(value: FormDataEntryValue | null): Locale {
  return routing.locales.find((l) => l === value) ?? routing.defaultLocale;
}

export type RequestState = {
  status: "idle" | "sent" | "invalid" | "error";
  email?: string;
  /** Only in local development and tests: the link, shown on screen. */
  devLink?: string;
  devUnknown?: boolean;
};

export async function requestSignInLink(
  _previous: RequestState,
  form: FormData,
): Promise<RequestState> {
  const locale = localeOf(form.get("locale"));
  const email = normalizeEmail(String(form.get("email") ?? ""));

  // Field hidden from people, filled by robots.
  if (String(form.get("website") ?? "")) return { status: "sent", email };
  if (!isEmail(email)) return { status: "invalid", email };
  if (!hasDatabase()) return { status: "error", email };

  const token = newToken();
  const allowed = await withSystem(async (q) => {
    if (!(await mayAccess(q, email))) return false;
    const [{ recent }] = await q<{ recent: number }>(
      `select count(*) as recent from private.login_tokens
       where email = $1 and created_at > now() - interval '1 hour'`,
      [email],
    );
    if (recent >= LINKS_PER_HOUR) return false;
    await q(
      `insert into private.login_tokens (email, token_hash, purpose, expires_at)
       values ($1, $2, 'login', now() + make_interval(mins => $3))`,
      [email, hashToken(token), LINK_MINUTES],
    );
    return true;
  });

  // The answer is the same whether the address is known or not, so that
  // nobody can find out who belongs to the family.
  const mode = deliveryMode();
  if (!allowed) {
    return {
      status: "sent",
      email,
      devUnknown: mode === "screen" || undefined,
    };
  }

  const path = getPathname({
    locale,
    href: { pathname: "/connexion/confirmer", query: { jeton: token } },
  });
  const url = new URL(path, siteUrl()).toString();
  const t = await getTranslations({ locale, namespace: "auth.email" });
  try {
    await sendEmail(
      simpleEmail({
        to: email,
        topic: "login",
        subject: t("subject"),
        lines: [t("line1"), t("line2", { minutes: LINK_MINUTES })],
        action: { label: t("action"), url },
        footer: t("footer"),
      }),
    );
  } catch (error) {
    console.error(error);
    return { status: "error", email };
  }

  return {
    status: "sent",
    email,
    devLink: mode === "screen" ? url : undefined,
  };
}

export type ConfirmState = { status: "idle" | "expired" };

export async function confirmSignIn(
  _previous: ConfirmState,
  form: FormData,
): Promise<ConfirmState> {
  const locale = localeOf(form.get("locale"));
  const token = String(form.get("token") ?? "");
  if (!token || !hasDatabase()) return { status: "expired" };

  const sessionToken = newToken();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  const role = await withSystem(async (q) => {
    const used = await q<{ email: string }>(
      `update private.login_tokens set used_at = now()
       where token_hash = $1 and used_at is null and expires_at > now()
       returning email`,
      [hashToken(token)],
    );
    const email = used[0]?.email;
    if (!email || !(await mayAccess(q, email))) return null;

    const role = await roleFor(q, email);
    const [account] = await q<{ id: string }>(
      `insert into private.accounts (email, last_login_at) values ($1, now())
       on conflict (email) do update set last_login_at = now()
       returning id`,
      [email],
    );
    const [profile] = await q<{ role: "admin" | "member"; disabled: boolean }>(
      `insert into public.profiles (id, role, preferred_locale, display_name)
       values ($1, $2, $3, coalesce(
         (select full_name from public.invitations
          where email = $4 and full_name is not null order by created_at desc limit 1),
         (select full_name from public.access_requests
          where email = $4 and state = 'approved' order by created_at desc limit 1)))
       on conflict (id) do update
         set role = case when excluded.role = 'admin' then 'admin'::public.member_role
                         else public.profiles.role end,
             display_name = coalesce(public.profiles.display_name, excluded.display_name)
       returning role, disabled_at is not null as disabled`,
      [account.id, role, locale, email],
    );
    if (profile.disabled) return null;
    await q(
      `update public.invitations set accepted_at = now()
       where email = $1 and accepted_at is null`,
      [email],
    );
    await q(
      `insert into private.sessions (account_id, token_hash, expires_at, user_agent)
       values ($1, $2, now() + make_interval(days => $3), $4)`,
      [account.id, hashToken(sessionToken), SESSION_DAYS, userAgent],
    );
    return profile.role;
  });

  if (!role) return { status: "expired" };

  const jar = await cookies();
  const common = {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
  jar.set(SESSION_COOKIE, sessionToken, { ...common, httpOnly: true });
  jar.set(SIGNED_IN_COOKIE, role, { ...common, httpOnly: false });

  redirect({ href: role === "admin" ? "/admin" : "/compte", locale });
  return { status: "idle" };
}

export async function signOut(form: FormData): Promise<void> {
  const locale = localeOf(form.get("locale"));
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && hasDatabase()) {
    await withSystem((q) =>
      q("delete from private.sessions where token_hash = $1", [
        hashToken(token),
      ]),
    );
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
  redirect({ href: "/", locale });
}
