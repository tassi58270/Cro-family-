"use server";

import { asAdmin, id, text } from "@/lib/admin/form";
import { summarize, type ProposalPayload } from "@/lib/contributions/kinds";
import { absoluteUrl, tell } from "@/lib/contributions/notify";
import { routing, type Locale } from "@/lib/i18n/routing";

/**
 * Answering a proposal (section 7): accepted or declined, with a word for
 * its author, who is told by email. « C’est moi » links the account to the
 * person once accepted; other proposals are applied by the administrator in
 * the right screen.
 */

export type DecisionState = {
  status: "idle" | "saved" | "error";
  savedAt?: number;
};

export async function markReviewing(form: FormData): Promise<void> {
  const proposal = id(form, "id");
  if (!proposal) return;
  await asAdmin((q, session) =>
    q(
      `update public.suggestions set state = 'reviewing', reviewed_by = $2
       where id = $1 and state = 'sent'`,
      [proposal, session.accountId],
    ),
  );
}

export async function decide(
  _previous: DecisionState,
  form: FormData,
): Promise<DecisionState> {
  const proposal = id(form, "id");
  const decision = text(form, "decision");
  if (!proposal || !["accept", "reject"].includes(decision))
    return { status: "error" };
  const reply = text(form, "reply").slice(0, 2000) || null;
  const state = decision === "accept" ? "accepted" : "rejected";

  try {
    const author = await asAdmin(async (q, session) => {
      const [row] = await q<{
        author_id: string;
        kind: string;
        target_id: string | null;
        payload: ProposalPayload;
      }>(
        `update public.suggestions
         set state = $2, admin_reply = $3, reviewed_by = $4, reviewed_at = now()
         where id = $1
         returning author_id, kind::text as kind, target_id, payload`,
        [proposal, state, reply, session.accountId],
      );
      if (!row) return null;
      if (state === "accepted" && row.kind === "claim" && row.target_id)
        await q("update public.profiles set person_id = $2 where id = $1", [
          row.author_id,
          row.target_id,
        ]);
      const [member] = await q<{ email: string }>(
        "select email from public.admin_members() where id = $1",
        [row.author_id],
      );
      const [profile] = await q<{ preferred_locale: Locale }>(
        "select preferred_locale from public.profiles where id = $1",
        [row.author_id],
      );
      return member
        ? {
            email: member.email,
            locale: profile?.preferred_locale ?? routing.defaultLocale,
            summary: summarize(row.kind, row.payload ?? {}),
          }
        : null;
    });
    if (author) {
      await tell(author.email, author.locale, `suggestion-${state}`, (t) => ({
        subject:
          state === "accepted"
            ? t("decision.acceptedSubject")
            : t("decision.rejectedSubject"),
        lines: [
          t("helloNoName"),
          state === "accepted"
            ? t("decision.accepted", { summary: author.summary })
            : t("decision.rejected", { summary: author.summary }),
          ...(reply ? [t("decision.reply", { reply })] : []),
        ],
        action: {
          label: t("decision.action"),
          url: absoluteUrl(author.locale, "/compte"),
        },
      }));
    }
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}
