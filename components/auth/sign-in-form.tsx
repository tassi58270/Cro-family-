"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  requestSignInLink,
  type RequestState,
} from "@/app/[locale]/(public)/connexion/actions";
import { Tremas } from "@/components/ui/bands";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

const initial: RequestState = { status: "idle" };

export function SignInForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(requestSignInLink, initial);

  if (state.status === "sent") {
    return (
      <div className="grid gap-4" role="status">
        <h2 className="font-display text-title-sm">{t("sentTitle")}</h2>
        <p className="text-ink-muted">
          {t("sentBody", { email: state.email ?? "" })}
        </p>
        {state.devLink && (
          <p className="grid gap-2 border border-dashed border-hairline-strong p-4 text-caption">
            <span className="text-ink-muted">{t("devMode")}</span>
            <a className="link font-medium break-all" href={state.devLink}>
              {t("devLink")}
            </a>
          </p>
        )}
        {state.devUnknown && (
          <p className="border border-dashed border-hairline-strong p-4 text-caption text-ink-muted">
            {t("devUnknown")}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {/* Hidden from people: only robots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <TextField
        label={t("emailLabel")}
        hint={t("emailHint")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={
          state.status === "invalid"
            ? t("invalidEmail")
            : state.status === "error"
              ? t("sendError")
              : undefined
        }
      />
      <div>
        <Button type="submit" busy={pending}>
          {t("submit")}
        </Button>
      </div>
      <p className="flex items-baseline gap-3 text-caption text-ink-muted">
        <Tremas />
        {t("noPassword")}
      </p>
    </form>
  );
}
