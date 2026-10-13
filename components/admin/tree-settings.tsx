"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  addLinkProof,
  deleteEntryPoint,
  deleteLineage,
  removeLinkProof,
  saveEntryPoint,
  saveLineage,
  setLinkCertainty,
  type TreeSettingsState,
} from "@/app/[locale]/(admin)/admin/lignees/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type {
  AdminEntryPoint,
  AdminLineage,
  AdminLineageStep,
} from "@/lib/data/admin-tree";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import {
  AdminSection,
  DeleteButton,
  FormFooter,
  PersonPicker,
  Translations,
  TreeProvider,
  useFormWords,
  useSaved,
} from "./admin-kit";

const initial: TreeSettingsState = { status: "idle" };

type Panel =
  | { kind: "entry"; item?: AdminEntryPoint }
  | { kind: "lineage"; item?: AdminLineage }
  | { kind: "proof"; step: AdminLineageStep };

function EntryForm({
  item,
  locale,
  onSaved,
}: {
  item?: AdminEntryPoint;
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.lineages");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveEntryPoint, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <PersonPicker
        name="person"
        label={t("entries.person")}
        initialId={item?.person.id}
        error={error("person")}
        locale={locale}
      />
      <TextField
        label={t("entries.label")}
        hint={t("entries.labelHint")}
        name="label_fr"
        defaultValue={item?.labels.fr ?? ""}
        error={error("label_fr")}
      />
      <Checkbox
        name="isDefault"
        label={t("entries.isDefault")}
        defaultChecked={item?.isDefault ?? false}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <TextField
            key={l}
            lang={l}
            label={`${t("entries.label")} · ${tLang(l)}`}
            name={`label_${l}`}
            defaultValue={item?.labels[l] ?? ""}
          />
        ))}
      </Translations>
      <FormFooter
        pending={pending}
        state={state}
        save={words.save}
        error={words.error}
      />
    </form>
  );
}

function LineageForm({
  item,
  locale,
  onSaved,
}: {
  item?: AdminLineage;
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.lineages");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveLineage, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("lineages.titleField")}
        name="title_fr"
        defaultValue={item?.titles.fr ?? ""}
        error={error("title_fr")}
      />
      <PersonPicker
        name="start"
        label={t("lineages.start")}
        initialId={item?.start.id}
        error={error("start")}
        locale={locale}
      />
      <PersonPicker
        name="end"
        label={t("lineages.end")}
        initialId={item?.end.id}
        error={error("end")}
        locale={locale}
      />
      <TextArea
        label={t("lineages.introField")}
        hint={t("lineages.introHint")}
        name="intro_fr"
        rows={3}
        defaultValue={item?.intros.fr ?? ""}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("lineages.titleField")}
              name={`title_${l}`}
              defaultValue={item?.titles[l] ?? ""}
            />
            <TextArea
              label={t("lineages.introField")}
              name={`intro_${l}`}
              rows={3}
              defaultValue={item?.intros[l] ?? ""}
            />
          </fieldset>
        ))}
      </Translations>
      <FormFooter
        pending={pending}
        state={state}
        save={words.save}
        error={words.error}
      />
    </form>
  );
}

function ProofForm({
  step,
  onSaved,
}: {
  step: AdminLineageStep;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.lineages");
  const tKinds = useTranslations("tree.proofs.kinds");
  const [state, onSubmit, pending] = useFormAction(addLinkProof, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="parent" value={step.parent.id} />
      <input type="hidden" name="child" value={step.child.id} />
      <p className="text-caption text-ink-muted">
        {t("proof.about", { parent: step.parent.name, child: step.child.name })}
      </p>
      <SelectField label={t("proof.kind")} name="kind" defaultValue="document">
        {(
          ["document", "archive", "book", "website", "oral", "other"] as const
        ).map((k) => (
          <option key={k} value={k}>
            {tKinds(k)}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t("proof.title")}
        hint={t("proof.titleHint")}
        name="title"
        error={state.errors?.title ? t("errors.required") : undefined}
      />
      <TextField
        label={t("proof.reference")}
        hint={t("proof.referenceHint")}
        name="reference"
      />
      <TextField label={t("proof.repository")} name="repository" />
      <TextField label={t("proof.url")} name="url" type="url" inputMode="url" />
      <TextArea
        label={t("proof.transcription")}
        name="transcription"
        rows={4}
      />
      <TextArea label={t("proof.translation")} name="translation" rows={4} />
      <TextField
        label={t("proof.note")}
        hint={t("proof.noteHint")}
        name="note"
      />
      <FormFooter
        pending={pending}
        state={state}
        save={words.save}
        error={words.error}
      />
    </form>
  );
}

function Step({
  step,
  onAddProof,
}: {
  step: AdminLineageStep;
  onAddProof: () => void;
}) {
  const t = useTranslations("admin.lineages");
  const tCertainty = useTranslations("tree.certainty");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <li className="grid gap-3 border-l-2 border-croy py-1 pl-4">
      <p className="grid gap-0.5">
        <span className="font-medium">
          {step.parent.name} <span aria-hidden="true">→</span>
          <span className="sr-only">{t("step.parentOf")}</span>{" "}
          {step.child.name}
        </span>
        <span className="tabular text-caption text-ink-muted">
          {[step.parent.years, step.child.years].filter(Boolean).join(" · ")}
        </span>
      </p>
      <label className="flex flex-wrap items-center gap-3 text-caption">
        <span className="font-medium">{t("step.certainty")}</span>
        <select
          defaultValue={step.certainty}
          disabled={pending}
          onChange={(event) => {
            const form = new FormData();
            form.set("parent", step.parent.id);
            form.set("child", step.child.id);
            form.set("certainty", event.target.value);
            startTransition(async () => {
              await setLinkCertainty(form);
              router.refresh();
            });
          }}
          className="min-h-10 rounded-full border border-hairline-strong bg-paper px-3"
        >
          {(["attested", "tradition", "debated"] as const).map((c) => (
            <option key={c} value={c}>
              {tCertainty(c)}
            </option>
          ))}
        </select>
      </label>
      {step.sources.length ? (
        <ul className="grid gap-2">
          {step.sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption"
            >
              <span className="font-medium">{s.title}</span>
              {s.reference && (
                <span className="text-ink-muted">{s.reference}</span>
              )}
              <form
                action={async (form) => {
                  await removeLinkProof(form);
                  router.refresh();
                }}
              >
                <input type="hidden" name="source" value={s.id} />
                <input type="hidden" name="parent" value={step.parent.id} />
                <input type="hidden" name="child" value={step.child.id} />
                <button type="submit" className="link min-h-11 text-ink-muted">
                  {t("step.removeProof")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-croy-text">{t("step.noProof")}</p>
      )}
      <p>
        <button
          type="button"
          onClick={onAddProof}
          className="link min-h-11 text-caption font-medium"
        >
          {t("step.addProof")}
        </button>
      </p>
    </li>
  );
}

export function TreeSettings({
  entries,
  lineages,
  locale,
}: {
  entries: AdminEntryPoint[];
  lineages: AdminLineage[];
  locale: string;
}) {
  const t = useTranslations("admin.lineages");
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = () => setPanel(null);
  const savedAndClose = () => {
    setPanel(null);
    router.refresh();
  };

  return (
    <TreeProvider locale={locale}>
      <div className="grid gap-12">
        <header className="grid gap-2">
          <h1 className="font-display text-title">{t("title")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
        </header>

        <AdminSection
          id="entrees"
          title={t("entries.title")}
          intro={t("entries.intro")}
          action={
            <Button
              variant="secondary"
              onClick={() => setPanel({ kind: "entry" })}
            >
              {t("entries.add")}
            </Button>
          }
        >
          {entries.length ? (
            <ul className="grid border-t border-hairline">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">{e.labels.fr}</span>
                    <span className="text-caption text-ink-muted">
                      {e.person.name} {e.person.years && `· ${e.person.years}`}
                    </span>
                  </span>
                  {e.isDefault && (
                    <StatusChip status="published">
                      {t("entries.default")}
                    </StatusChip>
                  )}
                  {e.isDemo && (
                    <StatusChip status="draft">{t("demoBadge")}</StatusChip>
                  )}
                  <button
                    type="button"
                    className="link min-h-11 text-caption font-medium"
                    onClick={() => setPanel({ kind: "entry", item: e })}
                  >
                    {t("edit")}
                  </button>
                  <DeleteButton
                    action={deleteEntryPoint}
                    id={e.id}
                    label={t("delete")}
                    confirm={t("confirmDelete")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("entries.empty")}</p>
          )}
        </AdminSection>

        <AdminSection
          id="lignees"
          title={t("lineages.title")}
          intro={t("lineages.intro")}
          action={
            <Button
              variant="secondary"
              onClick={() => setPanel({ kind: "lineage" })}
            >
              {t("lineages.add")}
            </Button>
          }
        >
          {lineages.length ? (
            <div className="grid gap-10">
              {lineages.map((l) => (
                <article key={l.id} className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <h3 className="min-w-0 flex-1 font-display text-[1.375rem] max-sm:basis-full">
                      {l.titles.fr}
                    </h3>
                    {l.isDemo && (
                      <StatusChip status="draft">{t("demoBadge")}</StatusChip>
                    )}
                    <button
                      type="button"
                      className="link min-h-11 text-caption font-medium"
                      onClick={() => setPanel({ kind: "lineage", item: l })}
                    >
                      {t("edit")}
                    </button>
                    <DeleteButton
                      action={deleteLineage}
                      id={l.id}
                      label={t("delete")}
                      confirm={t("confirmDelete")}
                    />
                  </div>
                  <p className="text-caption text-ink-muted">
                    {t("lineages.fromTo", {
                      start: l.start.name,
                      end: l.end.name,
                    })}
                  </p>
                  {l.intros.fr && <p className="max-w-2xl">{l.intros.fr}</p>}
                  {l.steps === null ? (
                    <p className="text-croy-text">
                      {t("lineages.notConnected")}
                    </p>
                  ) : (
                    <ol className="grid gap-5" aria-label={t("lineages.steps")}>
                      {l.steps.map((s) => (
                        <Step
                          key={`${s.parent.id}-${s.child.id}`}
                          step={s}
                          onAddProof={() =>
                            setPanel({ kind: "proof", step: s })
                          }
                        />
                      ))}
                    </ol>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-ink-muted">{t("lineages.empty")}</p>
          )}
        </AdminSection>
      </div>

      <SidePanel
        open={panel !== null}
        onClose={close}
        title={
          panel?.kind === "entry"
            ? panel.item
              ? t("entries.edit")
              : t("entries.add")
            : panel?.kind === "lineage"
              ? panel.item
                ? t("lineages.edit")
                : t("lineages.add")
              : t("step.addProof")
        }
      >
        {panel?.kind === "entry" && (
          <EntryForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            locale={locale}
            onSaved={savedAndClose}
          />
        )}
        {panel?.kind === "lineage" && (
          <LineageForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            locale={locale}
            onSaved={savedAndClose}
          />
        )}
        {panel?.kind === "proof" && (
          <ProofForm
            key={`${panel.step.parent.id}-${panel.step.child.id}`}
            step={panel.step}
            onSaved={savedAndClose}
          />
        )}
      </SidePanel>
    </TreeProvider>
  );
}
