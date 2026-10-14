"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  deleteHomeItem,
  moveHomeItem,
  saveChapter,
  saveFigure,
  saveHomeTexts,
  type HomeFormState,
} from "@/app/[locale]/(admin)/admin/accueil/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type { AdminHome } from "@/lib/data/admin-home";
import { cn } from "@/lib/design/cn";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

const LOCALES: Locale[] = ["fr", "en", "de"];
const FIGURE_KINDS = [
  "number",
  "people",
  "generations",
  "countries",
  "photos",
  "branches",
  "titles",
  "stories",
  "places",
] as const;
const ZOOMS = [1, 3, 5, 8] as const;
const initial: HomeFormState = { status: "idle" };

type Panel =
  | { kind: "figure"; item?: AdminHome["figures"][number] }
  | { kind: "chapter"; item?: AdminHome["chapters"][number] };

function Section({
  id,
  title,
  intro,
  action,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 border-t border-hairline pt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 id={id} className="font-display text-title-sm">
            {title}
          </h2>
          {intro && (
            <p className="max-w-2xl text-caption text-ink-muted">{intro}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function useSaved(state: HomeFormState, onSaved: () => void) {
  useEffect(() => {
    if (state.status === "saved") onSaved();
  }, [state.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps
}

function LocaleTabs({
  value,
  onChange,
  label,
}: {
  value: Locale;
  onChange: (l: Locale) => void;
  label: string;
}) {
  const t = useTranslations("common.languages");
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border border-hairline-strong p-0.5"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cn(
            "min-h-10 rounded-full px-4 text-caption font-medium transition-colors duration-(--duration-fast)",
            value === l ? "bg-ink text-paper" : "hover:bg-paper-2",
          )}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}

function TextsForm({ texts }: { texts: AdminHome["texts"] }) {
  const t = useTranslations("admin.home");
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("fr");
  const [state, onSubmit, pending] = useFormAction(saveHomeTexts, initial);
  const [done, setDone] = useState(false);
  useSaved(state, () => {
    setDone(true);
    router.refresh();
  });

  return (
    <div className="grid gap-6">
      <LocaleTabs
        value={locale}
        onChange={(l) => {
          setLocale(l);
          setDone(false);
        }}
        label={t("language")}
      />
      <form
        key={locale}
        onSubmit={onSubmit}
        className="grid max-w-3xl gap-6"
        lang={locale}
      >
        <input type="hidden" name="locale" value={locale} />
        <TextField
          label={t("tagline")}
          name="tagline"
          defaultValue={texts[locale].tagline}
        />
        <TextField
          label={t("pronunciation")}
          hint={t("pronunciationHint")}
          name="pronunciation"
          defaultValue={texts[locale].pronunciation}
        />
        <TextArea
          label={t("summary")}
          hint={t("summaryHint")}
          name="summary"
          rows={6}
          defaultValue={texts[locale].summary}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" busy={pending}>
            {t("save")}
          </Button>
          {done && (
            <p role="status" className="text-caption text-ink-muted">
              {t("saved")}
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className="text-caption text-croy-text">
              {t("errors.save")}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function Translations({ children }: { children: ReactNode }) {
  const t = useTranslations("admin.home");
  return (
    <details className="group border-t border-hairline pt-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-90"
        >
          ›
        </span>
        {t("translations")}
      </summary>
      <div className="mt-4 grid gap-6">{children}</div>
    </details>
  );
}

function ItemForm({
  panel,
  places,
  onSaved,
}: {
  panel: Panel;
  places: AdminHome["places"];
  onSaved: () => void;
}) {
  const t = useTranslations("admin.home");
  const tLang = useTranslations("common.languages");
  const action = panel.kind === "figure" ? saveFigure : saveChapter;
  const [state, onSubmit, pending] = useFormAction(action, initial);
  useSaved(state, onSaved);
  const error = (field: string) => {
    const code = state.errors?.[field];
    return code ? t(`errors.${code}`) : undefined;
  };
  const item = panel.kind === "figure" ? undefined : panel.item;

  if (panel.kind === "figure") {
    const figure = panel.item;
    return (
      <FigureFields
        figure={figure}
        onSubmit={onSubmit}
        pending={pending}
        error={error}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      {panel.kind === "chapter" && (
        <>
          <Checkbox
            name="prologue"
            label={t("chapter.prologue")}
            hint={t("chapter.prologueHint")}
            defaultChecked={panel.item?.prologue}
          />
          <TextField
            label={t("chapter.dateLabel")}
            hint={t("chapter.dateLabelHint")}
            name="date_label_fr"
            defaultValue={panel.item?.i18n.fr?.date_label ?? ""}
          />
        </>
      )}
      <TextField
        label={t("itemTitle")}
        name="title_fr"
        defaultValue={item?.i18n.fr?.title ?? ""}
        error={error("title_fr")}
      />
      <TextArea
        label={t("chapter.body")}
        hint={t("chapter.bodyHint")}
        name="body_fr"
        rows={5}
        defaultValue={item?.i18n.fr?.body ?? ""}
        error={error("body_fr")}
      />
      {panel.kind === "chapter" && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              label={t("chapter.eraStart")}
              name="eraStart"
              inputMode="numeric"
              defaultValue={panel.item?.eraStart ?? ""}
              error={error("eraStart")}
            />
            <TextField
              label={t("chapter.eraEnd")}
              name="eraEnd"
              inputMode="numeric"
              defaultValue={panel.item?.eraEnd ?? ""}
            />
          </div>
          <PlaceAndZoom chapter={panel.item} places={places} />
          <Checkbox
            name="published"
            label={t("published")}
            defaultChecked={
              panel.item ? panel.item.status === "published" : true
            }
          />
        </>
      )}
      <Translations>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} className="grid gap-4" lang={l}>
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            {panel.kind === "chapter" && (
              <TextField
                label={t("chapter.dateLabel")}
                name={`date_label_${l}`}
                defaultValue={panel.item?.i18n[l]?.date_label ?? ""}
              />
            )}
            <TextField
              label={t("itemTitle")}
              name={`title_${l}`}
              defaultValue={item?.i18n[l]?.title ?? ""}
            />
            <TextArea
              label={t("chapter.body")}
              name={`body_${l}`}
              rows={4}
              defaultValue={item?.i18n[l]?.body ?? ""}
            />
          </fieldset>
        ))}
      </Translations>
      {state.status === "error" && (
        <p role="alert" className="text-caption text-croy-text">
          {t("errors.save")}
        </p>
      )}
      <div>
        <Button type="submit" busy={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function PlaceAndZoom({
  chapter,
  places,
}: {
  chapter?: AdminHome["chapters"][number];
  places: AdminHome["places"];
}) {
  const t = useTranslations("admin.home.chapter");
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <SelectField
        label={t("place")}
        hint={t("placeHint")}
        name="placeId"
        defaultValue={chapter?.placeId ?? ""}
      >
        <option value="">{t("noPlace")}</option>
        {places.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.located}>
            {p.located ? p.name : `${p.name} (${t("notLocated")})`}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t("zoom")}
        name="zoom"
        defaultValue={String(chapter?.zoom ?? 1)}
      >
        {ZOOMS.map((z) => (
          <option key={z} value={z}>
            {t(`zooms.${z}`)}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function FigureFields({
  figure,
  onSubmit,
  pending,
  error,
}: {
  figure?: AdminHome["figures"][number];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  error: (field: string) => string | undefined;
}) {
  const t = useTranslations("admin.home");
  const tLang = useTranslations("common.languages");
  const [kind, setKind] = useState(figure?.kind ?? "number");
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={figure?.id ?? ""} />
      <SelectField
        label={t("figure.kind")}
        hint={t("figure.kindHint")}
        name="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        {FIGURE_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`figure.kinds.${k}`)}
          </option>
        ))}
      </SelectField>
      {kind === "number" && (
        <TextField
          label={t("figure.value")}
          name="value"
          inputMode="numeric"
          defaultValue={figure?.value ?? ""}
          error={error("value")}
        />
      )}
      <TextField
        label={t("figure.label")}
        hint={t("figure.labelHint")}
        name="label_fr"
        defaultValue={figure?.i18n.fr?.label ?? ""}
        error={error("label_fr")}
      />
      <Translations>
        {(["en", "de"] as const).map((l) => (
          <TextField
            key={l}
            lang={l}
            label={`${t("figure.label")} · ${tLang(l)}`}
            name={`label_${l}`}
            defaultValue={figure?.i18n[l]?.label ?? ""}
          />
        ))}
      </Translations>
      <Checkbox
        name="published"
        label={t("published")}
        defaultChecked={figure ? figure.status === "published" : true}
      />
      <div>
        <Button type="submit" busy={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function Row({
  children,
  onEdit,
  onDelete,
  onMove,
  first,
  last,
}: {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (d: -1 | 1) => void;
  first?: boolean;
  last?: boolean;
}) {
  const t = useTranslations("admin.home");
  const icon =
    "grid size-11 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-4">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex items-center gap-1">
        {onMove && (
          <>
            <button
              type="button"
              className={icon}
              disabled={first}
              onClick={() => onMove(-1)}
            >
              <span aria-hidden="true">↑</span>
              <span className="sr-only">{t("moveUp")}</span>
            </button>
            <button
              type="button"
              className={icon}
              disabled={last}
              onClick={() => onMove(1)}
            >
              <span aria-hidden="true">↓</span>
              <span className="sr-only">{t("moveDown")}</span>
            </button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={onEdit}>
          {t("edit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          {t("delete")}
        </Button>
      </div>
    </li>
  );
}

/** Dashboard › Accueil: every text and figure of the home page (section 7). */
export function HomeEditor({ data }: { data: AdminHome }) {
  const t = useTranslations("admin.home");
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const [, start] = useTransition();

  const show = (p: Panel) => {
    setPanel(p);
    setOpened((n) => n + 1);
    setOpen(true);
  };
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  const remove = (kind: "figure" | "chapter", id: string) => {
    if (window.confirm(t("deleteConfirm"))) run(() => deleteHomeItem(kind, id));
  };
  const fr = (v?: string | null) => v || "—";

  return (
    <div className="grid gap-12">
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-lead text-ink-muted">{t("intro")}</p>
      </header>

      <Section id="textes" title={t("texts")} intro={t("textsIntro")}>
        <TextsForm texts={data.texts} />
      </Section>

      <Section
        id="chiffres"
        title={t("figures")}
        intro={t("figuresIntro")}
        action={
          <Button size="sm" onClick={() => show({ kind: "figure" })}>
            {t("addFigure")}
          </Button>
        }
      >
        <ul>
          {data.figures.map((f, i) => (
            <Row
              key={f.id}
              first={i === 0}
              last={i === data.figures.length - 1}
              onMove={(d) => run(() => moveHomeItem("figure", f.id, d))}
              onEdit={() => show({ kind: "figure", item: f })}
              onDelete={() => remove("figure", f.id)}
            >
              <p className="flex flex-wrap items-baseline gap-3">
                <span className="tabular font-display text-title-sm">
                  {f.kind === "number"
                    ? f.value
                    : t(`figure.kinds.${f.kind as "people"}`)}
                </span>
                <span>{fr(f.i18n.fr?.label)}</span>
                {f.status !== "published" && (
                  <StatusChip status="draft">{t("draft")}</StatusChip>
                )}
              </p>
            </Row>
          ))}
        </ul>
        {data.figures.length === 0 && (
          <p className="text-ink-muted">{t("none")}</p>
        )}
      </Section>

      <Section
        id="chapitres"
        title={t("chapters")}
        intro={t("chaptersIntro")}
        action={
          <Button size="sm" onClick={() => show({ kind: "chapter" })}>
            {t("addChapter")}
          </Button>
        }
      >
        <ol>
          {data.chapters.map((c, i) => (
            <Row
              key={c.id}
              first={i === 0}
              last={i === data.chapters.length - 1}
              onMove={(d) => run(() => moveHomeItem("chapter", c.id, d))}
              onEdit={() => show({ kind: "chapter", item: c })}
              onDelete={() => remove("chapter", c.id)}
            >
              <p className="font-medium">
                <span className="tabular mr-3 font-display text-croy-text">
                  {c.i18n.fr?.date_label ??
                    (c.prologue ? t("chapter.prologue") : "")}
                </span>
                {fr(c.i18n.fr?.title)}
              </p>
              <p className="text-caption text-ink-muted">
                {[
                  c.placeName ?? t("chapter.noPlace"),
                  c.eraStart && `${c.eraStart}–${c.eraEnd ?? ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {c.status !== "published" && ` · ${t("draft")}`}
              </p>
            </Row>
          ))}
        </ol>
        {data.chapters.length === 0 && (
          <p className="text-ink-muted">{t("none")}</p>
        )}
      </Section>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title={panel ? t(`panel.${panel.kind}`) : ""}
      >
        {panel && (
          <ItemForm
            key={opened}
            panel={panel}
            places={data.places}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}
