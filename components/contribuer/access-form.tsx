"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  requestAccess,
  type AccessState,
} from "@/app/[locale]/(public)/contribuer/actions";
import { Tremas } from "@/components/ui/bands";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { useFormAction } from "@/lib/hooks/use-form-action";

const initial: AccessState = { status: "idle" };

/** « Demander un accès famille » (section 4): an administrator approves. */
export function AccessForm() {
  const t = useTranslations("contribute.access");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const [state, onSubmit, pending] = useFormAction(requestAccess, initial);
  const error = (field: string) => {
    const code = state.errors?.[field];
    if (!code) return undefined;
    return code === "email" ? tAuth("invalidEmail") : t("required");
  };

  if (state.status === "sent") {
    return (
      <div role="status" className="grid gap-4 rounded-xs bg-paper-2 p-6">
        <Tremas className="text-[1.25rem]" />
        <h3 className="font-display text-title-sm">{t("sentTitle")}</h3>
        <p className="text-ink-muted">{t("sentBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <input type="hidden" name="locale" value={locale} />
      {/* Hidden from people: only robots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <TextField
        label={t("name")}
        name="name"
        autoComplete="name"
        error={error("name")}
      />
      <TextField
        label={t("email")}
        hint={t("emailHint")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        error={error("email")}
      />
      <TextArea
        label={t("relation")}
        hint={t("relationHint")}
        name="relation"
        rows={3}
        error={error("relation")}
      />
      <TextArea label={t("message")} name="message" rows={3} />
      {state.status === "error" && (
        <p role="alert" className="font-medium text-croy-text">
          {t("error")}
        </p>
      )}
      <div>
        <Button type="submit" busy={pending}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
