"use client";

import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  savePerson,
  type PersonFormState,
  type Relation,
} from "@/app/[locale]/(admin)/admin/arbre/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, SelectField, TextField } from "@/components/ui/field";
import type { PersonSummary } from "@/lib/data/family";
import { cn } from "@/lib/design/cn";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { formatFuzzyDate, parseFuzzyDate } from "@/lib/genealogie/dates";

export type FormContext = {
  relation: Relation;
  relativeId?: string;
  /** For a child: the unions of the relative, to choose the other parent. */
  unions?: { id: string; label: string }[];
  person?: PersonSummary;
  /** Starting value of « Décédé(e) ». */
  deceasedByDefault?: boolean;
};

const initial: PersonFormState = { status: "idle" };

/** Shows how a typed date was understood, as the person types it. */
function DateHint({ value }: { value: string }) {
  const t = useTranslations("admin.person");
  const locale = useLocale();
  if (!value.trim()) return null;
  const parsed = parseFuzzyDate(value);
  return (
    <p
      aria-live="polite"
      className={cn(
        "text-caption",
        parsed ? "text-ink-muted" : "text-croy-text",
      )}
    >
      {parsed
        ? t("understood", { date: formatFuzzyDate(parsed, locale) })
        : t("notUnderstood")}
    </p>
  );
}

function initialDate(
  date: string | null,
  precision: PersonSummary["birth_precision"],
  locale: string,
) {
  return date && precision
    ? formatFuzzyDate({ date, precision }, locale).replace(/ /g, " ")
    : "";
}

/**
 * The quick form: only what is needed to place someone in the tree. Dates
 * are typed as they are known (« 1890 », « vers 1890 », « 12 mars 1890 »).
 */
export function PersonForm({
  context,
  onSaved,
}: {
  context: FormContext;
  onSaved: (personId: string) => void;
}) {
  const t = useTranslations("admin.person");
  const locale = useLocale();
  const [state, onSubmit, pending] = useFormAction(savePerson, initial);
  const person = context.person;
  const [birth, setBirth] = useState(
    initialDate(
      person?.birth_date ?? null,
      person?.birth_precision ?? null,
      locale,
    ),
  );
  const [death, setDeath] = useState(
    initialDate(
      person?.death_date ?? null,
      person?.death_precision ?? null,
      locale,
    ),
  );
  const [marriage, setMarriage] = useState("");
  const sexName = useId();

  useEffect(() => {
    if (state.status === "saved" && state.personId) onSaved(state.personId);
    // savedAt changes with every save.
  }, [state.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const error = (field: string) => {
    const code = state.errors?.[field] as "name" | "date" | "order" | undefined;
    return code ? t(`errors.${code}`) : undefined;
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6" id="person-form">
      <input type="hidden" name="id" value={person?.id ?? ""} />
      <input type="hidden" name="relation" value={context.relation} />
      <input type="hidden" name="relativeId" value={context.relativeId ?? ""} />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label={t("givenNames")}
          name="givenNames"
          autoComplete="off"
          autoFocus
          defaultValue={person?.given_names ?? ""}
          error={error("givenNames")}
        />
        <TextField
          label={t("surname")}
          name="surname"
          autoComplete="off"
          defaultValue={person?.surname ?? ""}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium">{t("sex")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["female", "male", "unknown"] as const).map((sex) => (
            <label
              key={sex}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-hairline-strong px-4 text-caption font-medium transition-colors has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-croy"
            >
              <input
                type="radio"
                name="sex"
                value={sex}
                className="sr-only"
                defaultChecked={(person?.sex ?? "unknown") === sex}
                id={`${sexName}-${sex}`}
              />
              {t(`sexes.${sex}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <TextField
            label={t("birth")}
            hint={t("dateHint")}
            name="birth"
            autoComplete="off"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
            error={error("birth")}
          />
          <DateHint value={birth} />
        </div>
        <TextField
          label={t("birthPlace")}
          name="birthPlace"
          autoComplete="off"
          defaultValue={person?.birth_place ?? ""}
        />
        <div className="grid gap-2">
          <TextField
            label={t("death")}
            hint={t("dateHint")}
            name="death"
            autoComplete="off"
            value={death}
            onChange={(e) => setDeath(e.target.value)}
            error={error("death")}
          />
          <DateHint value={death} />
        </div>
        <TextField
          label={t("deathPlace")}
          name="deathPlace"
          autoComplete="off"
          defaultValue={person?.death_place ?? ""}
        />
      </div>

      <Checkbox
        name="deceased"
        label={t("deceased")}
        hint={t("deceasedHint")}
        defaultChecked={person?.deceased ?? context.deceasedByDefault ?? false}
      />

      {context.relation === "partner" && (
        <div className="grid gap-6 border-t border-hairline pt-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <TextField
              label={t("marriage")}
              optionalLabel={t("optional")}
              name="marriage"
              autoComplete="off"
              value={marriage}
              onChange={(e) => setMarriage(e.target.value)}
              error={error("marriage")}
            />
            <DateHint value={marriage} />
          </div>
          <TextField
            label={t("marriagePlace")}
            optionalLabel={t("optional")}
            name="marriagePlace"
            autoComplete="off"
          />
        </div>
      )}

      {context.relation === "child" &&
        context.unions &&
        context.unions.length > 0 && (
          <SelectField
            label={t("otherParent")}
            name="unionId"
            defaultValue={context.unions[0].id}
          >
            {context.unions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
            <option value="none">{t("otherParentUnknown")}</option>
          </SelectField>
        )}

      <Checkbox
        name="published"
        label={t("published")}
        hint={t("publishedHint")}
        defaultChecked={person ? person.status === "published" : true}
      />

      {state.status === "error" && (
        <p role="alert" className="text-caption font-medium text-croy-text">
          {t("errors.save")}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={pending}>
          {person ? t("saveChanges") : t("add")}
        </Button>
      </div>
    </form>
  );
}
