"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  sendProposal,
  type ProposalState,
} from "@/app/[locale]/(public)/contribuer/actions";
import { PersonPicker, TreeProvider } from "@/components/admin/admin-kit";
import { Tremas } from "@/components/ui/bands";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import {
  PROPOSAL_KINDS,
  RELATIONS,
  type ProposalKind,
} from "@/lib/contributions/kinds";
import { cn } from "@/lib/design/cn";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { Attachments } from "./attachments";

const initial: ProposalState = { status: "idle" };
const STEPS = ["what", "about", "content"] as const;

/** Fields that must be filled before leaving a step, by kind. */
const REQUIRED: Partial<Record<ProposalKind, Record<number, string[]>>> = {
  correction: { 3: ["text"] },
  person: { 3: ["givenNames", "surname"] },
  place: { 2: ["name"] },
  event: { 2: ["title"] },
};

/**
 * The guided form of the Contribute page (6.7), in three steps: what, about
 * whom or what, then the content with its source and attachments. Photos
 * and stories lead to their own forms.
 */
export function ProposalForm() {
  const t = useTranslations("contribute.form");
  const locale = useLocale();
  const [state, onSubmit, pending] = useFormAction(sendProposal, initial);
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ProposalKind | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const redirect = kind === "photo" || kind === "story";

  function go(next: number) {
    setStep(next);
    setMissing([]);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function check(current: number) {
    const needed = (kind && REQUIRED[kind]?.[current]) ?? [];
    if (!needed.length || !form.current) return true;
    const data = new FormData(form.current);
    const filled = needed.some((f) => String(data.get(f) ?? "").trim());
    setMissing(filled ? [] : needed);
    return filled;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (step < 3) {
      event.preventDefault();
      if (kind && !redirect && check(step)) go(step + 1);
      return;
    }
    if (!check(3)) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  const error = (field: string, message = t("required")) =>
    missing.includes(field) ? message : undefined;

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="grid gap-5 rounded-xs bg-paper-2 p-6 md:p-8"
      >
        <Tremas className="text-[1.25rem]" />
        <h3 className="font-display text-title-sm">{t("sentTitle")}</h3>
        <p className="max-w-prose text-ink-muted">{t("sentBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setKind(null);
              setStep(1);
              setAttempt((a) => a + 1);
            }}
          >
            {t("another")}
          </Button>
          <ButtonLink href="/compte" variant="ghost">
            {t("follow")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <TreeProvider locale={locale}>
      <form
        key={attempt}
        ref={form}
        onSubmit={submit}
        noValidate
        className="grid gap-8"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="kind" value={kind ?? ""} />

        <ol aria-label={t("steps.label")} className="grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={step === i + 1 ? "step" : undefined}
              className="grid gap-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 rounded-full transition-colors duration-(--duration-base)",
                  step >= i + 1 ? "bg-croy" : "bg-hairline",
                )}
              />
              <span
                className={cn(
                  "text-caption",
                  step === i + 1 ? "font-medium text-ink" : "text-ink-muted",
                )}
              >
                {t(`steps.${s}`)}
              </span>
            </li>
          ))}
        </ol>

        <h3
          ref={heading}
          tabIndex={-1}
          className="font-display text-title-sm outline-none"
        >
          <span className="sr-only">
            {t("stepOf", { current: step, total: 3 })} ·{" "}
          </span>
          {step === 1
            ? t("what")
            : step === 2
              ? t("steps.about")
              : t("steps.content")}
        </h3>

        {/* 1. What */}
        <fieldset hidden={step !== 1} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{t("what")}</legend>
          {PROPOSAL_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "grid cursor-pointer gap-1 rounded-xs border p-4 transition-[border-color,background-color] duration-(--duration-fast)",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-croy",
                kind === k
                  ? "border-croy bg-paper-2"
                  : "border-hairline-strong hover:border-ink",
              )}
            >
              <input
                type="radio"
                name="choice"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-medium">
                {kind === k && <Tremas />}
                {t(`kinds.${k}`)}
              </span>
              <span className="text-caption text-ink-muted">
                {t(`kinds.${k}Hint`)}
              </span>
            </label>
          ))}
        </fieldset>

        {/* 2. About whom or what */}
        <div hidden={step !== 2} className="grid gap-6">
          {redirect && (
            <div className="grid gap-4 rounded-xs bg-paper-2 p-6">
              <p>{kind === "photo" ? t("photoGo") : t("storyGo")}</p>
              <div>
                <ButtonLink
                  href={
                    kind === "photo"
                      ? "/compte/photos"
                      : "/compte/histoires/nouvelle"
                  }
                >
                  {kind === "photo" ? t("photoAction") : t("storyAction")}
                </ButtonLink>
              </div>
            </div>
          )}
          {(kind === "correction" || kind === "event") && (
            <div className="grid gap-1">
              <PersonPicker
                name="target"
                label={t("aboutPerson")}
                locale={locale}
              />
              <p className="text-caption text-ink-muted">
                {t("aboutPersonHint")}
              </p>
            </div>
          )}
          {kind === "person" && (
            <>
              <div className="grid gap-1">
                <PersonPicker
                  name="target"
                  label={t("relativeOf")}
                  locale={locale}
                />
                <p className="text-caption text-ink-muted">
                  {t("relativeHint")}
                </p>
              </div>
              <SelectField
                label={t("relation")}
                name="relation"
                defaultValue=""
              >
                <option value="">{t("relations.none")}</option>
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`relations.${r}`)}
                  </option>
                ))}
              </SelectField>
            </>
          )}
          {kind === "place" && (
            <>
              <TextField
                label={t("fields.name")}
                name="name"
                error={error("name")}
              />
              <TextField
                label={t("fields.location")}
                hint={t("fields.locationHint")}
                name="location"
              />
            </>
          )}
          {kind === "event" && (
            <>
              <TextField
                label={t("fields.title")}
                name="title"
                error={error("title")}
              />
              <TextField
                label={t("fields.date")}
                hint={t("fields.dateHint")}
                name="date"
              />
              <TextField label={t("fields.place")} name="place" />
            </>
          )}
        </div>

        {/* 3. Content, source, attachments */}
        <div hidden={step !== 3} className="grid gap-6">
          {kind === "person" && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <TextField
                  label={t("fields.givenNames")}
                  name="givenNames"
                  error={error("givenNames", t("requiredPerson"))}
                />
                <TextField label={t("fields.surname")} name="surname" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <TextField
                  label={t("fields.birth")}
                  hint={t("fields.dateHint")}
                  name="birth"
                />
                <TextField label={t("fields.birthPlace")} name="birthPlace" />
                <TextField
                  label={t("fields.death")}
                  hint={t("fields.dateHint")}
                  name="death"
                />
                <TextField label={t("fields.deathPlace")} name="deathPlace" />
              </div>
            </>
          )}
          {kind && !redirect && (
            <TextArea
              label={
                kind === "correction"
                  ? t("fields.textCorrection")
                  : t("fields.text")
              }
              hint={
                kind === "correction"
                  ? t("fields.textCorrectionHint")
                  : t("fields.textHint")
              }
              name="text"
              rows={6}
              error={error("text")}
            />
          )}
          <TextField label={t("source")} hint={t("sourceHint")} name="source" />
          <Attachments name="attachments" />
          {state.status !== "idle" && (
            <p role="alert" className="font-medium text-croy-text">
              {t("error")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => go(step - 1)}>
              {t("back")}
            </Button>
          )}
          {step < 3 && !(step === 2 && redirect) && (
            <Button type="submit" disabled={!kind}>
              {t("next")}
            </Button>
          )}
          {step === 3 && (
            <Button type="submit" busy={pending}>
              {t("submit")}
            </Button>
          )}
        </div>
      </form>
    </TreeProvider>
  );
}
