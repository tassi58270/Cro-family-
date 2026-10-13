"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  saveStory,
  type StoryFormState,
} from "@/app/[locale]/(membre)/compte/histoires/actions";
import { PeoplePicker, TreeProvider } from "@/components/admin/admin-kit";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import type { EditableStory } from "@/lib/data/story-editor";
import { THEMES_LIST } from "@/lib/data/story-types";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import { PhotoPicker } from "./photo-picker";

const initial: StoryFormState = { status: "idle" };

/** A checkbox shown as a chip that fills when chosen. */
function ChipCheckbox({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-4 text-caption font-medium transition-colors duration-(--duration-fast) select-none peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-croy hover:border-ink">
        {label}
      </span>
    </label>
  );
}

/**
 * Writing a story (6.4): title, text, era, the people concerned chosen in
 * the tree, places, source and language. Saved as a draft, then sent for
 * validation; an administrator may publish directly.
 */
export function StoryEditor({
  story,
  places,
  locale,
  mode,
}: {
  story: EditableStory | null;
  places: { id: string; name: string }[];
  locale: string;
  mode: "member" | "admin";
}) {
  const t = useTranslations("storyEditor");
  const tThemes = useTranslations("stories.themes");
  const tLang = useTranslations("common.languages");
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(saveStory, initial);
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;

  useEffect(() => {
    if (state.status !== "saved" || !state.storyId) return;
    const list = mode === "admin" ? "/admin/histoires" : "/compte/histoires";
    if (state.intent === "draft" && !story) {
      router.replace(
        mode === "admin"
          ? {
              pathname: "/admin/histoires/[histoire]",
              params: { histoire: state.storyId },
            }
          : {
              pathname: "/compte/histoires/[histoire]",
              params: { histoire: state.storyId },
            },
      );
    } else if (state.intent !== "draft") {
      router.push(list);
    } else {
      router.refresh();
    }
  }, [state.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = mode === "member" && story?.status === "published";

  return (
    <TreeProvider locale={locale}>
      {locked ? (
        <p className="text-ink-muted">{t("published")}</p>
      ) : (
        <form onSubmit={onSubmit} className="grid max-w-3xl gap-8">
          <input type="hidden" name="id" value={story?.id ?? ""} />
          <TextField
            label={t("title")}
            name="title"
            defaultValue={story?.title}
            error={error("title")}
          />
          <TextArea
            label={t("body")}
            hint={t("bodyHint")}
            name="body"
            rows={16}
            defaultValue={story?.body}
            error={error("body")}
          />
          <TextArea
            label={t("excerpt")}
            hint={t("excerptHint")}
            optionalLabel={t("optional")}
            name="excerpt"
            rows={2}
            defaultValue={story?.excerpt}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              label={t("eraStart")}
              hint={t("eraHint")}
              name="eraStart"
              inputMode="numeric"
              defaultValue={story?.eraStart ?? ""}
              error={error("eraStart")}
            />
            <TextField
              label={t("eraEnd")}
              name="eraEnd"
              inputMode="numeric"
              defaultValue={story?.eraEnd ?? ""}
              error={error("eraEnd")}
            />
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-2 font-medium">{t("themes")}</legend>
            <div className="flex flex-wrap gap-2">
              {THEMES_LIST.map((theme) => (
                <ChipCheckbox
                  key={theme}
                  name="themes"
                  value={theme}
                  label={tThemes(theme)}
                  defaultChecked={story?.themes.includes(theme) ?? false}
                />
              ))}
            </div>
          </fieldset>
          <PeoplePicker
            name="people"
            label={t("people")}
            hint={t("peopleHint")}
            initialIds={story?.people ?? []}
            locale={locale}
          />
          {places.length > 0 && (
            <fieldset className="grid gap-3">
              <legend className="mb-2 font-medium">{t("places")}</legend>
              <div className="flex flex-wrap gap-2">
                {places.map((p) => (
                  <ChipCheckbox
                    key={p.id}
                    name="places"
                    value={p.id}
                    label={p.name}
                    defaultChecked={story?.places.includes(p.id) ?? false}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <TextField
            label={t("source")}
            hint={t("sourceHint")}
            optionalLabel={t("optional")}
            name="source"
            defaultValue={story?.source}
          />
          <SelectField
            label={t("language")}
            hint={t("languageHint")}
            name="language"
            defaultValue={story?.originalLocale ?? locale}
          >
            {(["fr", "en", "de"] as const).map((l) => (
              <option key={l} value={l}>
                {tLang(l)}
              </option>
            ))}
          </SelectField>
          <Checkbox
            name="anonymous"
            label={t("anonymous")}
            hint={t("anonymousHint")}
            defaultChecked={story?.anonymous ?? false}
          />
          {mode === "admin" && (
            <Checkbox
              name="featured"
              label={t("featured")}
              defaultChecked={story?.featured ?? false}
            />
          )}
          <PhotoPicker
            name="photos"
            initialIds={story?.photos ?? []}
            locale={locale}
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
            {mode === "admin" ? (
              <Button
                type="submit"
                name="intent"
                value="publish"
                busy={pending}
              >
                {t("publish")}
              </Button>
            ) : (
              <Button type="submit" name="intent" value="submit" busy={pending}>
                {t("submit")}
              </Button>
            )}
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="secondary"
              busy={pending}
            >
              {t("saveDraft")}
            </Button>
            {state.status === "saved" && state.intent === "draft" && (
              <p role="status" className="text-caption text-ink-muted">
                {t("draftSaved")}
              </p>
            )}
            {state.status === "invalid" && (
              <p role="alert" className="text-caption text-croy-text">
                {t("errors.form")}
              </p>
            )}
            {state.status === "error" && (
              <p role="alert" className="text-caption text-croy-text">
                {t("errors.save")}
              </p>
            )}
          </div>
          {mode === "member" && (
            <p className="text-caption text-ink-muted">{t("validationNote")}</p>
          )}
        </form>
      )}
    </TreeProvider>
  );
}
