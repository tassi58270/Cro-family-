"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { PersonSearch } from "@/components/arbre/person-search";
import { Button } from "@/components/ui/button";
import type { TreeData } from "@/lib/data/tree";
import { buildModel, type TreeModel } from "@/lib/genealogie/tree-model";
import { useRouter } from "@/lib/i18n/navigation";

/**
 * Pieces shared by the dashboard screens: picking a person from the tree,
 * the translations fold, sections, delete buttons and the form footer.
 */

type FormState = { status: string; savedAt?: number };

/** The whole tree, as the administrator sees it, to pick people from. */
const TreeContext = createContext<{ data: TreeData; model: TreeModel } | null>(
  null,
);

export function TreeProvider({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const [tree, setTree] = useState<TreeData | null>(null);
  const context = useMemo(
    () => (tree ? { data: tree, model: buildModel(tree) } : null),
    [tree],
  );
  useEffect(() => {
    fetch(`/api/arbre/${locale}/membres`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<TreeData>) : null))
      .then(setTree)
      .catch(() => setTree(null));
  }, [locale]);
  return <TreeContext value={context}>{children}</TreeContext>;
}

export function useSaved(state: FormState, onSaved: () => void) {
  useEffect(() => {
    if (state.status === "saved") onSaved();
  }, [state.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function PersonPicker({
  name,
  label,
  initialId,
  error,
  locale,
}: {
  name: string;
  label: string;
  initialId?: string | null;
  error?: string;
  locale: string;
}) {
  const tree = use(TreeContext);
  const [chosen, setChosen] = useState(initialId ?? "");
  const index = tree ? tree.model.byId.get(chosen) : undefined;
  return (
    <div className="grid gap-2">
      <p className="font-medium" aria-hidden="true">
        {label}
      </p>
      <input type="hidden" name={name} value={chosen} />
      {tree ? (
        <PersonSearch
          data={tree.data}
          model={tree.model}
          locale={locale}
          label={label}
          placeholder={label}
          size="small"
          value={index ?? null}
          onPick={(p) => setChosen(tree.data.people[p].id)}
        />
      ) : (
        <div className="h-11 animate-pulse rounded-full bg-paper-2" />
      )}
      {error && (
        <p className="text-caption font-medium text-croy-text">{error}</p>
      )}
    </div>
  );
}

export function Translations({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-hairline pt-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-90"
        >
          ›
        </span>
        {label}
      </summary>
      <div className="mt-4 grid gap-6">{children}</div>
    </details>
  );
}

export function FormFooter({
  pending,
  state,
  save,
  error,
}: {
  pending: boolean;
  state: FormState;
  save: string;
  error: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button type="submit" busy={pending}>
        {save}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-caption text-croy-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminSection({
  id,
  title,
  intro,
  action,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  action: ReactNode;
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
          <p className="max-w-2xl text-caption text-ink-muted">{intro}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DeleteButton({
  action,
  id,
  label,
  confirm,
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  label: string;
  confirm: string;
}) {
  const router = useRouter();
  return (
    <form
      action={async (form) => {
        if (!window.confirm(confirm)) return;
        await action(form);
        router.refresh();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="link min-h-11 text-caption text-ink-muted"
      >
        {label}
      </button>
    </form>
  );
}

/** Common wording of the dashboard forms. */
export function useFormWords() {
  const t = useTranslations("admin.lineages");
  return {
    save: t("save"),
    error: t("errors.save"),
    translations: t("translations"),
  };
}
