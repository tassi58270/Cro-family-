"use server";

import { asAdmin, id, text } from "@/lib/admin/form";
import { isEmail, normalizeEmail } from "@/lib/auth/tokens";
import { sendWelcome } from "@/lib/contributions/notify";
import { withSystem } from "@/lib/db";
import { deliveryMode } from "@/lib/email";
import { routing, type Locale } from "@/lib/i18n/routing";

/**
 * Who has access (sections 4 and 7): invitations, access requests, roles,
 * disabling an account. An administrator cannot demote or disable
 * themselves, so that the site always keeps one.
 */

export type InviteState = {
  status: "idle" | "sent" | "invalid" | "error";
  email?: string;
  /** Only in local development and tests: the link that was « sent ». */
  devLink?: string;
  sentAt?: number;
};

function localeOf(value: string): Locale {
  return routing.locales.find((l) => l === value) ?? routing.defaultLocale;
}

export async function invite(
  _previous: InviteState,
  form: FormData,
): Promise<InviteState> {
  const email = normalizeEmail(text(form, "email"));
  if (!isEmail(email)) return { status: "invalid" };
  const name = text(form, "name").slice(0, 200) || null;
  const message = text(form, "message").slice(0, 2000) || null;
  const role = text(form, "role") === "admin" ? "admin" : "member";
  const locale = localeOf(text(form, "language"));
  try {
    await asAdmin((q, session) =>
      q(
        `insert into public.invitations (email, role, invited_by, full_name, locale, message)
         values ($1, $2, $3, $4, $5, $6)`,
        [email, role, session.accountId, name, locale, message],
      ),
    );
    const url = await sendWelcome(email, locale, "invitation", {
      name,
      message,
    });
    return {
      status: "sent",
      email,
      devLink: deliveryMode() === "screen" ? url : undefined,
      sentAt: Date.now(),
    };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function cancelInvitation(form: FormData): Promise<void> {
  const invitation = id(form, "id");
  if (!invitation) return;
  await asAdmin((q) =>
    q("delete from public.invitations where id = $1 and accepted_at is null", [
      invitation,
    ]),
  );
}

export async function answerRequest(form: FormData): Promise<void> {
  const request = id(form, "id");
  const approve = text(form, "decision") === "approve";
  if (!request) return;
  const answered = await asAdmin(async (q, session) => {
    const [row] = await q<{ email: string; full_name: string; locale: Locale }>(
      `update public.access_requests
       set state = $2, reviewed_by = $3, reviewed_at = now()
       where id = $1 and state = 'pending'
       returning email::text as email, full_name, locale`,
      [request, approve ? "approved" : "rejected", session.accountId],
    );
    return row;
  });
  if (answered && approve)
    await sendWelcome(answered.email, answered.locale, "approved", {
      name: answered.full_name,
    });
}

export async function changeAccount(form: FormData): Promise<void> {
  const account = id(form, "id");
  const change = text(form, "change");
  if (!account) return;
  const changed = await asAdmin(async (q, session) => {
    if (account === session.accountId) return false;
    if (change === "admin" || change === "member")
      await q("update public.profiles set role = $2 where id = $1", [
        account,
        change,
      ]);
    if (change === "disable" || change === "enable")
      await q(
        `update public.profiles set disabled_at = ${change === "disable" ? "now()" : "null"}
         where id = $1`,
        [account],
      );
    return true;
  });
  // A disabled account is signed out everywhere at once.
  if (changed && change === "disable")
    await withSystem((q) =>
      q("delete from private.sessions where account_id = $1", [account]),
    );
}
