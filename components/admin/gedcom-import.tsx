"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  gedcomAction,
  type ImportState,
} from "@/app/[locale]/(admin)/admin/import/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { useFormAction } from "@/lib/hooks/use-form-action";

const initial: ImportState = { status: "idle" };

export function GedcomImport() {
  const t = useTranslations("admin.import");
  const [state, onSubmit, pending] = useFormAction(gedcomAction, initial);
  const form = useRef<HTMLFormElement>(null);

  if (state.status === "done") {
    return (
      <div className="grid gap-5" role="status">
        <h2 className="font-display text-title-sm">{t("doneTitle")}</h2>
        <p className="text-ink-muted">
          {t("doneBody", {
            people: state.result.people,
            unions: state.result.unions,
            links: state.result.links,
            reused: state.result.reused,
          })}
        </p>
        <div>
          <ButtonLink href="/admin/arbre">{t("openTree")}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-8">
      <div className="grid gap-2">
        <label htmlFor="gedcom-file" className="font-medium">
          {t("file")}
        </label>
        <p id="gedcom-hint" className="text-caption text-ink-muted">
          {t("fileHint")}
        </p>
        <input
          id="gedcom-file"
          name="file"
          type="file"
          accept=".ged,.gedcom,.txt"
          required
          aria-describedby="gedcom-hint"
          className="block w-full text-caption file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-xs file:border file:border-ink file:bg-paper file:px-4 file:font-medium file:text-ink hover:file:bg-ink hover:file:text-paper"
        />
        {state.status === "invalid" && (
          <p role="alert" className="text-caption font-medium text-croy-text">
            {t(`errors.${state.reason}`)}
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-caption font-medium text-croy-text">
            {t("errors.server")}
          </p>
        )}
      </div>

      {state.status === "preview" && (
        <section
          aria-labelledby="apercu"
          className="grid gap-6 border-y border-hairline py-8"
        >
          <h2 id="apercu" className="font-display text-title-sm">
            {t("previewTitle", { file: state.fileName })}
          </h2>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {(["people", "families", "places", "living"] as const).map(
              (key) => (
                <div key={key} className="grid gap-1">
                  <dt className="text-caption text-ink-muted">
                    {t(`counts.${key}`)}
                  </dt>
                  <dd className="tabular font-display text-title">
                    {state.preview[key]}
                  </dd>
                </div>
              ),
            )}
          </dl>
          {state.preview.sample.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-caption font-medium text-ink-muted">
                {t("sample")}
              </h3>
              <ul className="tabular grid gap-1">
                {state.preview.sample.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {state.preview.duplicates.length > 0 && (
            <p className="text-ink-muted">
              {t("duplicates", { count: state.preview.duplicates.length })}
            </p>
          )}
          {(state.preview.undatedDates.length > 0 ||
            state.preview.notes > 0 ||
            state.preview.missing > 0) && (
            <div className="grid gap-2 bg-paper-2 p-4 text-caption">
              <h3 className="font-medium">{t("warningsTitle")}</h3>
              {state.preview.undatedDates.length > 0 && (
                <p>
                  {t("warnings.dates", {
                    count: state.preview.undatedDates.length,
                  })}{" "}
                  <span className="text-ink-muted">
                    {state.preview.undatedDates.slice(0, 5).join(" ; ")}
                  </span>
                </p>
              )}
              {state.preview.notes > 0 && (
                <p>{t("warnings.notes", { count: state.preview.notes })}</p>
              )}
              {state.preview.missing > 0 && (
                <p>{t("warnings.missing", { count: state.preview.missing })}</p>
              )}
            </div>
          )}
          <Checkbox
            name="published"
            label={t("publish")}
            hint={t("publishHint")}
            defaultChecked
          />
          <Checkbox
            name="reuse"
            label={t("reuse")}
            hint={t("reuseHint")}
            defaultChecked
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {state.status === "preview" ? (
          <>
            <Button type="submit" name="intent" value="import" busy={pending}>
              {t("import", { count: state.preview.people })}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="preview"
              variant="secondary"
            >
              {t("analyseAgain")}
            </Button>
          </>
        ) : (
          <Button type="submit" name="intent" value="preview" busy={pending}>
            {t("analyse")}
          </Button>
        )}
      </div>
    </form>
  );
}
