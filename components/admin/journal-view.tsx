"use client";

import { useTranslations } from "next-intl";
import {
  undoChange,
  type UndoState,
} from "@/app/[locale]/(admin)/admin/journal/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import type { JournalChange } from "@/lib/data/journal";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";

const initial: UndoState = { status: "idle" };

function useNames() {
  const t = useTranslations("admin.journal");
  const named = (key: string, fallback: string) =>
    t.has(key as never) ? t(key as never) : fallback;
  return {
    table: (name: string) => named(`tables.${name}`, name),
    field: (name: string) => named(`fields.${name}`, name),
  };
}

function UndoButton({ change }: { change: JournalChange }) {
  const t = useTranslations("admin.journal");
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(
    async (previous: UndoState, form: FormData) => {
      const next = await undoChange(previous, form);
      if (next.status === "done") router.refresh();
      return next;
    },
    initial,
  );
  return (
    <form
      onSubmit={(event) => {
        if (!window.confirm(t("confirm"))) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="at" value={change.at} />
      <input type="hidden" name="actor" value={change.actorId ?? ""} />
      <div>
        <Button type="submit" variant="secondary" size="sm" busy={pending}>
          {t("undo")}
        </Button>
      </div>
      {state.status === "later" && (
        <p role="alert" className="text-caption font-medium text-croy-text">
          {t("later")}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-caption font-medium text-croy-text">
          {t("error")}
        </p>
      )}
    </form>
  );
}

/** One line per change, its details folded, and the undo button. */
export function JournalView({
  changes,
  locale,
  compact = false,
}: {
  changes: JournalChange[];
  locale: string;
  compact?: boolean;
}) {
  const t = useTranslations("admin.journal");
  const names = useNames();
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (!changes.length) return <p className="text-ink-muted">{t("empty")}</p>;
  return (
    <ol className="grid border-t border-hairline">
      {changes.map((change) => {
        const [main] = change.entries;
        return (
          <li
            key={`${change.at}-${change.actorId}`}
            className="grid gap-2 border-b border-hairline py-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">
                {change.undoes
                  ? t("undoOf", {
                      date: when.format(new Date(change.undoes)),
                    })
                  : main
                    ? `${t(`actions.${main.action}`)} · ${names.table(main.table)}`
                    : "—"}
              </span>
              {!change.undoes && change.label && (
                <span className="min-w-0 truncate">{change.label}</span>
              )}
              {change.reverted && (
                <StatusChip status="rejected">{t("undone")}</StatusChip>
              )}
            </div>
            <p className="text-caption text-ink-muted">
              {when.format(new Date(change.at))} ·{" "}
              {change.actor ? t("by", { name: change.actor }) : t("bySite")}
              {change.rows > 1 && ` · ${t("more", { count: change.rows - 1 })}`}
            </p>
            {!compact && (
              <details className="group">
                <summary className="link inline-flex min-h-11 cursor-pointer items-center text-caption">
                  {t("details")}
                </summary>
                <ul className="mt-2 grid gap-3">
                  {change.entries.map((e, i) => (
                    <li key={i} className="grid gap-1 text-caption">
                      <p>
                        <span className="font-medium">
                          {t(`actions.${e.action}`)} · {names.table(e.table)}
                        </span>
                        {e.label && (
                          <span className="text-ink-muted"> · {e.label}</span>
                        )}
                      </p>
                      {e.fields.length > 0 && (
                        <table className="w-full max-w-2xl table-fixed border-collapse">
                          <thead className="sr-only">
                            <tr>
                              <th scope="col">—</th>
                              <th scope="col">{t("before")}</th>
                              <th scope="col">{t("after")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {e.fields.map((f) => (
                              <tr key={f.name} className="align-top">
                                <th
                                  scope="row"
                                  className="w-36 py-1 pr-3 text-left font-normal text-ink-muted"
                                >
                                  {names.field(f.name)}
                                </th>
                                <td className="py-1 pr-3 break-words text-ink-muted line-through decoration-hairline-strong">
                                  {f.before}
                                </td>
                                <td className="py-1 break-words">{f.after}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!compact && !change.reverted && !change.undoes && (
              <UndoButton change={change} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
