"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  proposeTranslation,
  saveTranslation,
  type TranslationFormState,
} from "@/app/[locale]/(admin)/admin/traductions/actions";
import { Button } from "@/components/ui/button";
import { StatusChip, type ContentStatus } from "@/components/ui/chip";
import { SidePanel } from "@/components/ui/side-panel";
import type {
  TranslatableKind,
  TranslationItem,
  TranslationRow,
  TranslationState,
} from "@/lib/data/translations";
import { cn } from "@/lib/design/cn";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useSaved } from "./admin-kit";

const initial: TranslationFormState = { status: "idle" };
const SHORT = new Set(["name", "title", "caption", "alt"]);
const CHIP: Record<TranslationState, ContentStatus> = {
  missing: "rejected",
  machine: "pending",
  original: "published",
  reviewed: "published",
};

function Editor({
  item,
  machine,
  onSaved,
}: {
  item: TranslationItem;
  machine: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.translations");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveTranslation, initial);
  useSaved(state, onSaved);
  const [values, setValues] = useState(item.texts);
  const [asking, setAsking] = useState<"en" | "de" | null>(null);
  const [failed, setFailed] = useState(false);

  async function propose(target: "en" | "de") {
    setAsking(target);
    setFailed(false);
    const result = await proposeTranslation(
      item.fields.map((f) => item.texts.fr[f] ?? ""),
      target,
    );
    setAsking(null);
    if (!result) {
      setFailed(true);
      return;
    }
    setValues((v) => ({
      ...v,
      [target]: Object.fromEntries(item.fields.map((f, i) => [f, result[i]])),
    }));
  }

  const field = (name: string) =>
    t.has(`fields.${name}` as never) ? t(`fields.${name}` as never) : name;

  return (
    <form onSubmit={onSubmit} className="grid gap-8">
      <input type="hidden" name="kind" value={item.kind} />
      <input type="hidden" name="id" value={item.id} />
      {item.fields.map((f) => (
        <fieldset key={f} className="grid gap-3">
          <legend className="mb-1 font-medium">{field(f)}</legend>
          <div className="grid gap-1">
            <p className="text-caption text-ink-muted">{tLang("fr")}</p>
            <p lang="fr" className="whitespace-pre-line text-ink-muted">
              {item.texts.fr[f] || "—"}
            </p>
          </div>
          {(["en", "de"] as const).map((l) => {
            const Control = SHORT.has(f) ? "input" : "textarea";
            const fieldId = `${f}_${l}`;
            const error = state.errors?.[fieldId];
            return (
              <div key={l} className="grid gap-1">
                <label htmlFor={fieldId} className="text-caption font-medium">
                  {tLang(l)}
                </label>
                <Control
                  id={fieldId}
                  name={fieldId}
                  lang={l}
                  value={values[l][f] ?? ""}
                  onChange={(event) =>
                    setValues((v) => ({
                      ...v,
                      [l]: { ...v[l], [f]: event.target.value },
                    }))
                  }
                  rows={Control === "textarea" ? 4 : undefined}
                  aria-invalid={error ? true : undefined}
                  className={cn(
                    "w-full rounded-xs border border-hairline-strong bg-paper px-4 text-body",
                    Control === "textarea" ? "min-h-28 py-3" : "min-h-12",
                    error && "border-croy",
                  )}
                />
                {error && (
                  <p className="text-caption font-medium text-croy-text">
                    {t("required")}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
      <div className="grid gap-3 border-t border-hairline pt-6">
        {machine ? (
          <div className="flex flex-wrap gap-3">
            {(["en", "de"] as const).map((l) => (
              <Button
                key={l}
                type="button"
                variant="ghost"
                size="sm"
                busy={asking === l}
                onClick={() => propose(l)}
              >
                {t("propose", { language: tLang(l) })}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-caption text-ink-muted">{t("noMachine")}</p>
        )}
        {failed && (
          <p role="alert" className="text-caption font-medium text-croy-text">
            {t("machineError")}
          </p>
        )}
        <p className="text-caption text-ink-muted">{t("reviewHint")}</p>
        <div>
          <Button type="submit" busy={pending}>
            {t("save")}
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-caption font-medium text-croy-text">
            {t("error")}
          </p>
        )}
      </div>
    </form>
  );
}

/** French, English and German side by side (section 7). */
export function TranslationsAdmin({
  rows,
  item,
  kind,
  all,
  kinds,
  machine,
}: {
  rows: TranslationRow[];
  item: TranslationItem | null;
  kind: TranslatableKind | null;
  all: boolean;
  kinds: readonly TranslatableKind[];
  machine: boolean;
}) {
  const t = useTranslations("admin.translations");
  const tLang = useTranslations("common.languages");
  const router = useRouter();
  const query = (extra: Record<string, string> = {}) => ({
    ...(kind ? { sorte: kind } : {}),
    ...(all ? { tout: "1" } : {}),
    ...extra,
  });
  const close = () =>
    router.push({ pathname: "/admin/traductions", query: query() });

  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <h1 className="font-display text-title">{t("title")}</h1>
        <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
      </header>

      <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
        {[null, ...kinds].map((k) => (
          <Link
            key={k ?? "all"}
            href={{
              pathname: "/admin/traductions",
              query: {
                ...(k ? { sorte: k } : {}),
                ...(all ? { tout: "1" } : {}),
              },
            }}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-caption font-medium",
              k === kind
                ? "border-ink bg-ink text-paper"
                : "border-hairline-strong hover:border-ink",
            )}
          >
            {k ? t(`kinds.${k}`) : t("allKinds")}
          </Link>
        ))}
        <Link
          href={{
            pathname: "/admin/traductions",
            query: {
              ...(kind ? { sorte: kind } : {}),
              ...(all ? {} : { tout: "1" }),
            },
          }}
          className="link inline-flex min-h-11 items-center px-2 text-caption"
        >
          {all ? t("onlyMissing") : t("showAll")}
        </Link>
      </nav>

      {rows.length ? (
        <ul className="grid border-t border-hairline">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="border-b border-hairline">
              <Link
                href={{
                  pathname: "/admin/traductions",
                  query: query({ ouvrir: `${r.kind}:${r.id}` }),
                }}
                scroll={false}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 transition-colors duration-(--duration-fast) hover:bg-paper-2 md:px-3"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{r.label || "—"}</span>
                  <span className="text-caption text-ink-muted">
                    {t(`kinds.${r.kind}`)}
                  </span>
                </span>
                {(["en", "de"] as const).map((l) => (
                  <StatusChip key={l} status={CHIP[r[l]]}>
                    {`${tLang(l)} · ${t(`states.${r[l]}`)}`}
                  </StatusChip>
                ))}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{t("none")}</p>
      )}

      <SidePanel
        open={item !== null}
        onClose={close}
        title={item ? item.label || t(`kinds.${item.kind}`) : ""}
      >
        {item && (
          <Editor
            key={`${item.kind}-${item.id}`}
            item={item}
            machine={machine}
            onSaved={() => {
              close();
              router.refresh();
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}
