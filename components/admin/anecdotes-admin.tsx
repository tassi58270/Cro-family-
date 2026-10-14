"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteAnecdote,
  saveAnecdote,
  type AnecdoteState,
} from "@/app/[locale]/(admin)/admin/histoires/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import { Checkbox, TextArea, TextField } from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type { AdminAnecdote } from "@/lib/data/anecdotes";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import {
  AdminSection,
  DeleteButton,
  FormFooter,
  PeoplePicker,
  Translations,
  TreeProvider,
  useFormWords,
  useSaved,
} from "./admin-kit";

const initial: AnecdoteState = { status: "idle" };

function AnecdoteForm({
  item,
  places,
  locale,
  onSaved,
}: {
  item?: AdminAnecdote;
  places: { id: string; name: string }[];
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.anecdotes");
  const tLang = useTranslations("common.languages");
  const words = useFormWords();
  const [state, onSubmit, pending] = useFormAction(saveAnecdote, initial);
  useSaved(state, onSaved);
  const error = (field: string) =>
    state.errors?.[field] ? t("required") : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("titleField")}
        hint={t("titleHint")}
        name="title_fr"
        defaultValue={item?.texts.fr.title}
        error={error("title_fr")}
      />
      <TextArea
        label={t("body")}
        hint={t("bodyHint")}
        name="body_fr"
        rows={5}
        defaultValue={item?.texts.fr.body}
        error={error("body_fr")}
      />
      <PeoplePicker
        name="people"
        label={t("people")}
        hint={t("peopleHint")}
        initialIds={item?.people ?? []}
        locale={locale}
      />
      {places.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 font-medium">{t("places")}</legend>
          <div className="flex flex-wrap gap-x-6">
            {places.map((p) => (
              <Checkbox
                key={p.id}
                name="places"
                value={p.id}
                label={p.name}
                defaultChecked={item?.places.includes(p.id)}
              />
            ))}
          </div>
        </fieldset>
      )}
      <Checkbox
        name="published"
        label={t("published")}
        hint={t("publishedHint")}
        defaultChecked={item ? item.published : true}
      />
      <Checkbox
        name="featured"
        label={t("featured")}
        hint={t("featuredHint")}
        defaultChecked={item?.featured}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("titleField")}
              name={`title_${l}`}
              defaultValue={item?.texts[l].title}
            />
            <TextArea
              label={t("body")}
              name={`body_${l}`}
              rows={3}
              defaultValue={item?.texts[l].body}
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

/**
 * « Anecdotes et histoires » (section 7): an anecdote in one short form,
 * linked to people and places, published at once or put « à la une ».
 */
export function AnecdotesAdmin({
  anecdotes,
  places,
  locale,
}: {
  anecdotes: AdminAnecdote[];
  places: { id: string; name: string }[];
  locale: string;
}) {
  const t = useTranslations("admin.anecdotes");
  const tCommon = useTranslations("admin.lineages");
  const router = useRouter();
  const [panel, setPanel] = useState<{ item?: AdminAnecdote } | null>(null);
  return (
    <TreeProvider locale={locale}>
      <AdminSection
        id="anecdotes"
        title={t("title")}
        intro={t("intro")}
        action={
          <Button variant="secondary" onClick={() => setPanel({})}>
            {t("add")}
          </Button>
        }
      >
        {anecdotes.length ? (
          <ul className="grid border-t border-hairline">
            {anecdotes.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">
                    {a.texts.fr.title || a.slug}
                  </span>
                  {a.peopleNames.length > 0 && (
                    <span className="truncate text-caption text-ink-muted">
                      {a.peopleNames.join(", ")}
                    </span>
                  )}
                </span>
                {a.featured && (
                  <StatusChip status="pending">{t("featuredChip")}</StatusChip>
                )}
                {!a.published && (
                  <StatusChip status="draft">{t("draft")}</StatusChip>
                )}
                <button
                  type="button"
                  className="link min-h-11 text-caption font-medium"
                  onClick={() => setPanel({ item: a })}
                >
                  {tCommon("edit")}
                </button>
                <DeleteButton
                  action={deleteAnecdote}
                  id={a.id}
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
          <AnecdoteForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            places={places}
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
