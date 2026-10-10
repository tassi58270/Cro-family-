"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  confirmSignIn,
  type ConfirmState,
} from "@/app/[locale]/(public)/connexion/actions";
import { Button, ButtonLink } from "@/components/ui/button";

const initial: ConfirmState = { status: "idle" };

/**
 * The link of the email lands here and the visitor confirms with a click.
 * Email scanners that open links on their own therefore cannot use it up.
 */
export function ConfirmForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(confirmSignIn, initial);

  if (state.status === "expired" || !token) {
    return (
      <div className="grid gap-4" role="alert">
        <h2 className="font-display text-title-sm">{t("expiredTitle")}</h2>
        <p className="text-ink-muted">{t("expiredBody")}</p>
        <div>
          <ButtonLink href="/connexion" variant="secondary">
            {t("newLink")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <p className="text-ink-muted">{t("confirmBody")}</p>
      <div>
        <Button type="submit" busy={pending}>
          {t("confirmButton")}
        </Button>
      </div>
    </form>
  );
}
