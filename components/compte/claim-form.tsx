"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  sendProposal,
  type ProposalState,
} from "@/app/[locale]/(public)/contribuer/actions";
import { PersonPicker, TreeProvider } from "@/components/admin/admin-kit";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/lib/hooks/use-form-action";

const initial: ProposalState = { status: "idle" };

/** « C’est moi » : the member points at themselves in the tree. */
export function ClaimForm() {
  const t = useTranslations("account");
  const locale = useLocale();
  const [state, onSubmit, pending] = useFormAction(sendProposal, initial);
  if (state.status === "sent")
    return (
      <p role="status" className="text-ink-muted">
        {t("claimSent")}
      </p>
    );
  return (
    <TreeProvider locale={locale}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <input type="hidden" name="kind" value="claim" />
        <input type="hidden" name="locale" value={locale} />
        <PersonPicker name="target" label={t("claimSearch")} locale={locale} />
        <p className="-mt-2 text-caption text-ink-muted">{t("claimHint")}</p>
        <div>
          <Button type="submit" variant="secondary" busy={pending}>
            {t("claim")}
          </Button>
        </div>
      </form>
    </TreeProvider>
  );
}
