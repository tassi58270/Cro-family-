"use client";

import { useTranslations } from "next-intl";
import {
  saveProfile,
  type ProfileState,
} from "@/app/[locale]/(membre)/compte/actions";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { routing } from "@/lib/i18n/routing";

const initial: ProfileState = { status: "idle" };

export function ProfileForm({
  displayName,
  locale,
}: {
  displayName: string;
  locale: string;
}) {
  const t = useTranslations("account");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveProfile, initial);
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <TextField
        label={t("displayName")}
        hint={t("displayNameHint")}
        name="displayName"
        autoComplete="name"
        defaultValue={displayName}
      />
      <SelectField label={t("language")} name="language" defaultValue={locale}>
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {tLang(l)}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" busy={pending}>
          {t("save")}
        </Button>
        {state.status === "saved" && (
          <p role="status" className="text-caption text-ink-muted">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
