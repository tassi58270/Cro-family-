"use server";

import { id, ids, text } from "@/lib/admin/form";
import { getSession, viewerOf } from "@/lib/auth/session";
import { isEmail, normalizeEmail } from "@/lib/auth/tokens";
import {
  readPayload,
  SUGGESTION_KINDS,
  summarize,
  type SuggestionKind,
} from "@/lib/contributions/kinds";
import {
  absoluteUrl,
  tell,
  tellAdministrators,
} from "@/lib/contributions/notify";
import { hasDatabase, VISITOR, withSystem, withViewer } from "@/lib/db";
import { routing, type Locale } from "@/lib/i18n/routing";

/**
 * Contributions (6.7): a visitor asks for access; a member sends a proposal.
 * Nothing changes on the site: an administrator reads and decides.
 */

function localeOf(value: FormDataEntryValue | null): Locale {
  return routing.locales.find((l) => l === value) ?? routing.defaultLocale;
}

export type AccessState = {
  status: "idle" | "sent" | "invalid" | "error";
  errors?: Record<string, "required" | "email">;
};

export async function requestAccess(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  const locale = localeOf(form.get("locale"));
  const email = normalizeEmail(text(form, "email"));
  const name = text(form, "name").slice(0, 200);
  const relation = text(form, "relation").slice(0, 2000);
  const message = text(form, "message").slice(0, 4000) || null;
  // Field hidden from people, filled by robots.
  if (text(form, "website")) return { status: "sent" };
  const errors: AccessState["errors"] = {};
  if (!name) errors.name = "required";
  if (!isEmail(email)) errors.email = "email";
  if (!relation) errors.relation = "required";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  if (!hasDatabase()) return { status: "error" };

  try {
    // One pending request per address and per day is enough.
    const recent = await withSystem((q) =>
      q(
        `select 1 from public.access_requests
         where email = $1 and created_at > now() - interval '1 day'`,
        [email],
      ),
    );
    if (recent.length) return { status: "sent" };
    await withViewer(VISITOR, (q) =>
      q(
        `insert into public.access_requests (email, full_name, relation, message, locale)
         values ($1, $2, $3, $4, $5)`,
        [email, name, relation, message, locale],
      ),
    );
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }

  await tellAdministrators("access-request", (t, adminLocale) => ({
    subject: t("accessRequest.subject", { name }),
    lines: [
      t("accessRequest.line1", { name, email }),
      t("accessRequest.relation", { relation }),
      ...(message ? [message] : []),
    ],
    action: {
      label: t("accessRequest.action"),
      url: absoluteUrl(adminLocale, "/admin/membres"),
    },
  }));
  return { status: "sent" };
}

export type ProposalState = {
  status: "idle" | "sent" | "invalid" | "error" | "signin";
  errors?: Record<string, "required">;
  sentAt?: number;
};

export async function sendProposal(
  _previous: ProposalState,
  form: FormData,
): Promise<ProposalState> {
  const session = await getSession();
  if (!session) return { status: "signin" };
  const locale = localeOf(form.get("locale"));
  const kind = text(form, "kind") as SuggestionKind;
  if (!(SUGGESTION_KINDS as readonly string[]).includes(kind))
    return { status: "invalid", errors: { kind: "required" } };
  const payload = readPayload(kind, (field) => text(form, field));
  const target = id(form, "target");
  if (!payload || (kind === "claim" && !target))
    return {
      status: "invalid",
      errors: { [kind === "claim" ? "target" : "content"]: "required" },
    };
  const source = text(form, "source").slice(0, 1000) || null;

  let suggestion: string;
  try {
    suggestion = await withViewer(viewerOf(session), async (q) => {
      // Only the member's own attachments, sent through this form.
      const attachments = (
        await q<{ id: string }>(
          `select id from public.media
           where id = any($1) and uploaded_by = $2 and storage_path like 'propositions/%'`,
          [ids(form, "attachments").slice(0, 6), session.accountId],
        )
      ).map((r) => r.id);
      const [row] = await q<{ id: string }>(
        `insert into public.suggestions
           (author_id, kind, target_table, target_id, payload, attachments, source)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [
          session.accountId,
          kind,
          target ? "people" : null,
          target,
          payload,
          attachments,
          source,
        ],
      );
      return row.id;
    });
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }

  const author = session.displayName || session.email;
  const summary = summarize(kind, payload);
  await tellAdministrators("suggestion", (t, adminLocale) => ({
    subject: t("suggestion.subject", { name: author }),
    lines: [
      t("suggestion.line1", { name: author, kind: t(`kinds.${kind}`) }),
      ...(summary ? [t("suggestion.summary", { summary })] : []),
    ],
    action: {
      label: t("suggestion.action"),
      url: absoluteUrl(adminLocale, {
        pathname: "/admin/propositions/[proposition]",
        params: { proposition: suggestion },
      }),
    },
  }));
  await tell(
    session.email,
    session.locale ?? locale,
    "suggestion-received",
    (t) => ({
      subject: t("received.subject"),
      lines: [t("received.line1"), t("received.line2")],
      action: {
        label: t("received.action"),
        url: absoluteUrl(session.locale ?? locale, "/compte"),
      },
    }),
  );
  return { status: "sent", sentAt: Date.now() };
}
