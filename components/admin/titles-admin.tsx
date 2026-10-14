"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteTitle,
  saveTitle,
  type TitleFormState,
} from "@/app/[locale]/(admin)/admin/armoiries/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type { AdminTitle } from "@/lib/data/admin-titles";
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

const initial: TitleFormState = { status: "idle" };

type Holder = AdminTitle["holders"][number] & { key: number };

function TitleForm({
  item,
  branches,
  locale,
  onSaved,
}: {
  item?: AdminTitle;
  branches: { id: string; name: string }[];
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.titles");
  const tLang = useTranslations("common.languages");
  const words = useFormWords();
  const [state, onSubmit, pending] = useFormAction(saveTitle, initial);
  useSaved(state, onSaved);
  const [holders, setHolders] = useState<Holder[]>(
    (item?.holders ?? []).map((h, key) => ({ ...h, key })),
  );
  const [next, setNext] = useState(holders.length);
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("name")}
        hint={t("nameHint")}
        name="name_fr"
        defaultValue={item?.texts.fr.name}
        error={error("name_fr")}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label={t("created")}
          hint={t("dateHint")}
          name="created"
          defaultValue={item?.created}
          error={error("created")}
        />
        <TextField
          label={t("creator")}
          hint={t("creatorHint")}
          name="creator"
          defaultValue={item?.creator}
        />
      </div>
      <SelectField
        label={t("branch")}
        name="branch"
        defaultValue={item?.branchId ?? ""}
      >
        <option value="">{t("noBranch")}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>
      <TextArea
        label={t("description")}
        name="description_fr"
        rows={3}
        defaultValue={item?.texts.fr.description}
      />

      <fieldset className="grid gap-4">
        <legend className="mb-1 font-medium">{t("holders")}</legend>
        <p className="-mt-2 text-caption text-ink-muted">{t("holdersHint")}</p>
        {holders.map((h, i) => (
          <div
            key={h.key}
            className="grid gap-3 rounded-xs border border-hairline p-4"
          >
            <PersonPicker
              name="holder_person"
              label={t("holder", { n: i + 1 })}
              initialId={h.personId}
              locale={locale}
            />
            <div className="grid grid-cols-3 gap-3">
              <TextField
                label={t("rank")}
                name="holder_rank"
                inputMode="numeric"
                defaultValue={h.rank ?? ""}
              />
              <TextField
                label={t("from")}
                name="holder_from"
                defaultValue={h.from}
                error={error(`holder_from_${i}`)}
              />
              <TextField
                label={t("to")}
                name="holder_to"
                defaultValue={h.to}
                error={error(`holder_to_${i}`)}
              />
            </div>
            <div>
              <button
                type="button"
                className="link min-h-11 text-caption text-ink-muted"
                onClick={() =>
                  setHolders((list) => list.filter((x) => x.key !== h.key))
                }
              >
                {t("removeHolder")}
              </button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setHolders((list) => [
                ...list,
                {
                  key: next,
                  personId: "",
                  name: "",
                  rank: list.length + 1,
                  from: "",
                  to: "",
                },
              ]);
              setNext((n) => n + 1);
            }}
          >
            {t("addHolder")}
          </Button>
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
              label={t("name")}
              name={`name_${l}`}
              defaultValue={item?.texts[l].name}
            />
            <TextArea
              label={t("description")}
              name={`description_${l}`}
              rows={2}
              defaultValue={item?.texts[l].description}
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

/** Titles and their successive holders (section 7, « Titres »). */
export function TitlesAdmin({
  titles,
  branches,
  locale,
}: {
  titles: AdminTitle[];
  branches: { id: string; name: string }[];
  locale: string;
}) {
  const t = useTranslations("admin.titles");
  const tCommon = useTranslations("admin.lineages");
  const router = useRouter();
  const [panel, setPanel] = useState<{ item?: AdminTitle } | null>(null);
  return (
    <TreeProvider locale={locale}>
      <AdminSection
        id="titres"
        title={t("title")}
        intro={t("intro")}
        action={
          <Button variant="secondary" onClick={() => setPanel({})}>
            {t("add")}
          </Button>
        }
      >
        {titles.length ? (
          <ul className="grid border-t border-hairline">
            {titles.map((title) => (
              <li
                key={title.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">
                    {title.texts.fr.name || title.slug}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {[
                      title.created,
                      t("holdersCount", { count: title.holders.length }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {!title.published && (
                  <StatusChip status="draft">{t("draft")}</StatusChip>
                )}
                {title.isDemo && (
                  <StatusChip status="draft">{tCommon("demoBadge")}</StatusChip>
                )}
                <button
                  type="button"
                  className="link min-h-11 text-caption font-medium"
                  onClick={() => setPanel({ item: title })}
                >
                  {tCommon("edit")}
                </button>
                <DeleteButton
                  action={deleteTitle}
                  id={title.id}
                  label={tCommon("delete")}
                  confirm={tCommon("confirmDelete")}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("none")}</p>
        )}
      </AdminSection>
      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.item ? t("edit") : t("add")}
      >
        {panel && (
          <TitleForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            branches={branches}
            locale={locale}
            onSaved={() => {
              setPanel(null);
              router.refresh();
            }}
          />
        )}
      </SidePanel>
    </TreeProvider>
  );
}
