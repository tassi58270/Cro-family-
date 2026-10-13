"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteArms,
  deleteBranch,
  saveArms,
  saveBranch,
  type ArmsFormState,
} from "@/app/[locale]/(admin)/admin/armoiries/actions";
import {
  Shield,
  builtInArms,
  type BuiltInArms,
} from "@/components/heraldique/shield";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type { AdminArms, AdminBranch } from "@/lib/data/admin-arms";
import { BRANCH_COLORS } from "@/lib/design/branch-colors";
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

const initial: ArmsFormState = { status: "idle" };
const DRAWINGS = ["croy", "croy-renty", "hongrie-ancienne"] as const;

type Panel =
  { kind: "branch"; item?: AdminBranch } | { kind: "arms"; item?: AdminArms };

function drawing(builtin: string | null): BuiltInArms | undefined {
  return builtin && (builtInArms as readonly string[]).includes(builtin)
    ? (builtin as BuiltInArms)
    : undefined;
}

function BranchForm({
  item,
  branches,
  locale,
  onSaved,
}: {
  item?: AdminBranch;
  branches: AdminBranch[];
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.arms");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveBranch, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  const [extinct, setExtinct] = useState(item?.extinct ?? false);
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("branch.name")}
        name="name_fr"
        defaultValue={item?.texts.fr.name}
        error={error("name_fr")}
      />
      <SelectField
        label={t("branch.parent")}
        name="parent"
        defaultValue={item?.parentId ?? ""}
        error={error("parent")}
      >
        <option value="">{t("branch.noParent")}</option>
        {branches
          .filter((b) => b.id !== item?.id)
          .map((b) => (
            <option key={b.id} value={b.id}>
              {b.texts.fr.name || b.slug}
            </option>
          ))}
      </SelectField>
      <PersonPicker
        name="founder"
        label={t("branch.founder")}
        initialId={item?.founderId}
        locale={locale}
      />
      <TextArea
        label={t("branch.description")}
        hint={t("branch.descriptionHint")}
        name="description_fr"
        rows={4}
        defaultValue={item?.texts.fr.description}
      />
      <Checkbox
        name="extinct"
        label={t("branch.extinct")}
        checked={extinct}
        onChange={(event) => setExtinct(event.target.checked)}
      />
      {extinct && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              label={t("branch.extinctMale")}
              name="extinctMale"
              inputMode="numeric"
              defaultValue={item?.extinctMale ?? ""}
              error={error("extinctMale")}
            />
            <TextField
              label={t("branch.extinctFemale")}
              name="extinctFemale"
              inputMode="numeric"
              defaultValue={item?.extinctFemale ?? ""}
              error={error("extinctFemale")}
            />
          </div>
          <PersonPicker
            name="lastPerson"
            label={t("branch.last")}
            initialId={item?.lastPersonId}
            locale={locale}
          />
          <TextArea
            label={t("branch.fate")}
            hint={t("branch.fateHint")}
            name="fate_fr"
            rows={3}
            defaultValue={item?.texts.fr.fate}
          />
        </>
      )}
      <fieldset className="grid gap-3">
        <legend className="mb-2 font-medium">{t("branch.color")}</legend>
        <div className="flex flex-wrap gap-2">
          {[null, ...BRANCH_COLORS].map((c) => (
            <label
              key={c ?? "auto"}
              className="relative grid size-11 cursor-pointer place-items-center"
            >
              <input
                type="radio"
                name="color"
                value={c ?? ""}
                defaultChecked={(item?.color ?? null) === c}
                className="peer sr-only"
              />
              <span
                className="size-8 rounded-full border border-hairline-strong peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-checked:ring-offset-paper peer-focus-visible:outline-2 peer-focus-visible:outline-croy"
                style={{
                  background:
                    c ??
                    "repeating-linear-gradient(45deg, var(--paper), var(--paper) 4px, var(--paper-2) 4px, var(--paper-2) 8px)",
                }}
              />
              <span className="sr-only">{c ?? t("branch.autoColor")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Checkbox
        name="published"
        label={t("published")}
        defaultChecked={item ? item.published : true}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("branch.name")}
              name={`name_${l}`}
              defaultValue={item?.texts[l].name}
            />
            <TextArea
              label={t("branch.description")}
              name={`description_${l}`}
              rows={3}
              defaultValue={item?.texts[l].description}
            />
            <TextArea
              label={t("branch.fate")}
              name={`fate_${l}`}
              rows={2}
              defaultValue={item?.texts[l].fate}
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

function ArmsForm({
  item,
  branches,
  locale,
  onSaved,
}: {
  item?: AdminArms;
  branches: AdminBranch[];
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.arms");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveArms, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  const [picked, setPicked] = useState(item?.builtin ?? "");
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("arms.name")}
        hint={t("arms.nameHint")}
        name="name_fr"
        defaultValue={item?.texts.fr.name}
        error={error("name_fr")}
      />
      <SelectField
        label={t("arms.kind")}
        name="kind"
        defaultValue={item?.kind ?? "family"}
      >
        {(["family", "alliance", "commune"] as const).map((k) => (
          <option key={k} value={k}>
            {t(`arms.kinds.${k}`)}
          </option>
        ))}
      </SelectField>
      {!item?.isDemo && (
        <fieldset className="grid gap-3">
          <legend className="mb-1 font-medium">{t("arms.drawing")}</legend>
          <p className="-mt-1 text-caption text-ink-muted">
            {t("arms.drawingHint")}
          </p>
          <div className="flex flex-wrap gap-3">
            {(["", ...DRAWINGS] as const).map((d) => (
              <label
                key={d || "none"}
                className="grid cursor-pointer justify-items-center gap-2 text-caption"
              >
                <input
                  type="radio"
                  name="builtin"
                  value={d}
                  checked={picked === d}
                  onChange={() => setPicked(d)}
                  className="peer sr-only"
                />
                <span className="rounded-xs p-2 ring-1 ring-hairline peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-croy">
                  <Shield arms={drawing(d)} decorative className="w-12" />
                </span>
                {d ? t(`arms.drawings.${d}`) : t("arms.noDrawing")}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <TextField
        label={t("arms.blazon")}
        hint={t("arms.blazonHint")}
        name="blazon_fr"
        defaultValue={item?.texts.fr.blazon}
      />
      <TextArea
        label={t("arms.explanation")}
        hint={t("arms.explanationHint")}
        name="explanation_fr"
        rows={3}
        defaultValue={item?.texts.fr.explanation}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label={t("arms.periodStart")}
          name="periodStart"
          inputMode="numeric"
          defaultValue={item?.periodStart ?? ""}
          error={error("periodStart")}
        />
        <TextField
          label={t("arms.periodEnd")}
          name="periodEnd"
          inputMode="numeric"
          defaultValue={item?.periodEnd ?? ""}
          error={error("periodEnd")}
        />
      </div>
      <SelectField
        label={t("arms.branch")}
        name="branch"
        defaultValue={item?.branchId ?? ""}
      >
        <option value="">{t("arms.noBranch")}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.texts.fr.name || b.slug}
          </option>
        ))}
      </SelectField>
      <PersonPicker
        name="person"
        label={t("arms.person")}
        initialId={item?.personId}
        locale={locale}
      />
      <TextField
        label={t("arms.familyName")}
        hint={t("arms.familyNameHint")}
        name="familyName"
        defaultValue={item?.familyName ?? ""}
      />
      <TextField
        label={t("arms.bearers")}
        hint={t("arms.bearersHint")}
        name="bearers_fr"
        defaultValue={item?.texts.fr.bearers}
      />
      <Checkbox
        name="published"
        label={t("published")}
        defaultChecked={item ? item.published : true}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("arms.name")}
              name={`name_${l}`}
              defaultValue={item?.texts[l].name}
            />
            <TextField
              label={t("arms.blazon")}
              name={`blazon_${l}`}
              defaultValue={item?.texts[l].blazon}
            />
            <TextArea
              label={t("arms.explanation")}
              name={`explanation_${l}`}
              rows={3}
              defaultValue={item?.texts[l].explanation}
            />
            <TextField
              label={t("arms.bearers")}
              name={`bearers_${l}`}
              defaultValue={item?.texts[l].bearers}
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

export function ArmsEditor({
  branches,
  arms,
  locale,
}: {
  branches: AdminBranch[];
  arms: AdminArms[];
  locale: string;
}) {
  const t = useTranslations("admin.arms");
  const tCommon = useTranslations("admin.lineages");
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const savedAndClose = () => {
    setPanel(null);
    router.refresh();
  };
  const branchName = (id: string | null) =>
    branches.find((b) => b.id === id)?.texts.fr.name;

  return (
    <TreeProvider locale={locale}>
      <div className="grid gap-12">
        <header className="grid gap-2">
          <h1 className="font-display text-title">{t("title")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
        </header>

        <AdminSection
          id="branches"
          title={t("branches.title")}
          intro={t("branches.intro")}
          action={
            <Button
              variant="secondary"
              onClick={() => setPanel({ kind: "branch" })}
            >
              {t("branches.add")}
            </Button>
          }
        >
          {branches.length ? (
            <ul className="grid border-t border-hairline">
              {branches.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full"
                        style={{
                          background: b.extinct
                            ? "var(--branch-extinct)"
                            : (b.color ?? "var(--hairline-strong)"),
                        }}
                      />
                      {b.texts.fr.name || b.slug}
                    </span>
                    <span className="tabular text-caption text-ink-muted">
                      {[
                        branchName(b.parentId) &&
                          t("branches.from", { name: branchName(b.parentId)! }),
                        b.founderName &&
                          t("branches.foundedBy", { name: b.founderName }),
                        b.extinct &&
                          t("branches.extinct", {
                            year: b.extinctMale ?? b.extinctFemale ?? "?",
                          }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {!b.published && (
                    <StatusChip status="draft">{t("draft")}</StatusChip>
                  )}
                  {b.isDemo && (
                    <StatusChip status="draft">
                      {tCommon("demoBadge")}
                    </StatusChip>
                  )}
                  <button
                    type="button"
                    className="link min-h-11 text-caption font-medium"
                    onClick={() => setPanel({ kind: "branch", item: b })}
                  >
                    {tCommon("edit")}
                  </button>
                  <DeleteButton
                    action={deleteBranch}
                    id={b.id}
                    label={tCommon("delete")}
                    confirm={tCommon("confirmDelete")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("branches.empty")}</p>
          )}
        </AdminSection>

        <AdminSection
          id="armoiries"
          title={t("armsList.title")}
          intro={t("armsList.intro")}
          action={
            <Button
              variant="secondary"
              onClick={() => setPanel({ kind: "arms" })}
            >
              {t("armsList.add")}
            </Button>
          }
        >
          {arms.length ? (
            <ul className="grid border-t border-hairline">
              {arms.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Shield
                      arms={drawing(a.builtin)}
                      decorative
                      className="w-8 shrink-0"
                    />
                    <span className="grid min-w-0">
                      <span className="font-medium">
                        {a.texts.fr.name || a.slug}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {[
                          t(`arms.kinds.${a.kind}`),
                          branchName(a.branchId),
                          a.familyName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                  {!a.published && (
                    <StatusChip status="draft">{t("draft")}</StatusChip>
                  )}
                  {a.isDemo && (
                    <StatusChip status="draft">
                      {tCommon("demoBadge")}
                    </StatusChip>
                  )}
                  <button
                    type="button"
                    className="link min-h-11 text-caption font-medium"
                    onClick={() => setPanel({ kind: "arms", item: a })}
                  >
                    {tCommon("edit")}
                  </button>
                  <DeleteButton
                    action={deleteArms}
                    id={a.id}
                    label={tCommon("delete")}
                    confirm={tCommon("confirmDelete")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("armsList.empty")}</p>
          )}
        </AdminSection>
      </div>

      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={
          panel?.kind === "branch"
            ? panel.item
              ? t("branches.edit")
              : t("branches.add")
            : panel?.item
              ? t("armsList.edit")
              : t("armsList.add")
        }
      >
        {panel?.kind === "branch" && (
          <BranchForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            branches={branches}
            locale={locale}
            onSaved={savedAndClose}
          />
        )}
        {panel?.kind === "arms" && (
          <ArmsForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            branches={branches}
            locale={locale}
            onSaved={savedAndClose}
          />
        )}
      </SidePanel>
    </TreeProvider>
  );
}
