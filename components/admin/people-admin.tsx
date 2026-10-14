"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  mergePeople,
  type MergeState,
} from "@/app/[locale]/(admin)/admin/personnes/actions";
import { Button } from "@/components/ui/button";
import { FilterChip, StatusChip } from "@/components/ui/chip";
import type { AdminPerson } from "@/lib/data/admin-people";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { normalizeForSearch as normalize } from "@/lib/search/normalize";

const initial: MergeState = { status: "idle" };
const PAGE = 100;

type View = "all" | "incomplete" | "duplicates";

function MergeGroup({ people }: { people: AdminPerson[] }) {
  const t = useTranslations("admin.people");
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(
    async (previous: MergeState, form: FormData) => {
      const next = await mergePeople(previous, form);
      if (next.status === "merged") router.refresh();
      return next;
    },
    initial,
  );
  return (
    <form
      onSubmit={(event) => {
        if (!window.confirm(t("mergeConfirm"))) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="grid gap-3 border-b border-hairline py-5"
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-caption text-ink-muted">
          {t("keepWhich")}
        </legend>
        {people.map((p, i) => (
          <label key={p.id} className="flex min-h-11 items-center gap-3">
            <input type="hidden" name="people" value={p.id} />
            <input
              type="radio"
              name="keep"
              value={p.id}
              defaultChecked={i === 0}
              className="size-5 accent-croy"
            />
            <span className="grid">
              <span className="font-medium">
                {p.name}
                {p.years && (
                  <span className="font-normal text-ink-muted">
                    {" "}
                    ({p.years})
                  </span>
                )}
              </span>
              <span className="text-caption text-ink-muted">
                {[p.branch, p.slug].filter(Boolean).join(" · ")}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" size="sm" busy={pending}>
          {t("merge")}
        </Button>
        {state.status === "error" && (
          <p role="alert" className="text-caption font-medium text-croy-text">
            {t("mergeError")}
          </p>
        )}
      </div>
    </form>
  );
}

/** Everyone, what each sheet lacks, and the possible duplicates. */
export function PeopleAdmin({
  people,
  duplicates,
}: {
  people: AdminPerson[];
  duplicates: string[][];
}) {
  const t = useTranslations("admin.people");
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const query = useDeferredValue(search);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const list = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean);
    return people.filter(
      (p) =>
        (view !== "incomplete" || p.missing.length > 0) &&
        words.every((w) => normalize(`${p.name} ${p.years}`).includes(w)),
    );
  }, [people, view, query]);
  const incomplete = people.filter((p) => p.missing.length).length;

  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <h1 className="font-display text-title">{t("title")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/arbre" className="link min-h-11 font-medium">
            {t("add")}
          </Link>
        </div>
      </header>

      <div className="grid gap-4">
        <div
          role="group"
          aria-label={t("views")}
          className="flex flex-wrap gap-2"
        >
          <FilterChip pressed={view === "all"} onClick={() => setView("all")}>
            {t("all", { count: people.length })}
          </FilterChip>
          <FilterChip
            pressed={view === "incomplete"}
            onClick={() => setView("incomplete")}
          >
            {t("incomplete", { count: incomplete })}
          </FilterChip>
          <FilterChip
            pressed={view === "duplicates"}
            onClick={() => setView("duplicates")}
          >
            {t("duplicates", { count: duplicates.length })}
          </FilterChip>
        </div>
        {view !== "duplicates" && (
          <label className="grid max-w-md gap-1">
            <span className="text-caption font-medium">{t("search")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShown(PAGE);
              }}
              className="min-h-12 rounded-full border border-hairline-strong bg-paper px-5"
            />
          </label>
        )}
      </div>

      {view === "duplicates" ? (
        duplicates.length ? (
          <div className="grid border-t border-hairline">
            <p className="py-4 text-caption text-ink-muted">
              {t("duplicatesIntro")}
            </p>
            {duplicates.map((group) => (
              <MergeGroup
                key={group.join()}
                people={group
                  .map((id) => byId.get(id))
                  .filter((p): p is AdminPerson => Boolean(p))}
              />
            ))}
          </div>
        ) : (
          <p className="text-ink-muted">{t("noDuplicates")}</p>
        )
      ) : list.length ? (
        <>
          <ul className="grid border-t border-hairline">
            {list.slice(0, shown).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">
                    {p.name}
                    {p.years && (
                      <span className="font-normal text-ink-muted">
                        {" "}
                        ({p.years})
                      </span>
                    )}
                  </span>
                  {p.missing.length > 0 && (
                    <span className="text-caption text-ink-muted">
                      {t("lacks", {
                        list: p.missing
                          .map((m) => t(`missing.${m}`))
                          .join(", "),
                      })}
                    </span>
                  )}
                </span>
                {!p.published && (
                  <StatusChip status="draft">{t("draft")}</StatusChip>
                )}
                <Link
                  href={{ pathname: "/admin/arbre", query: { personne: p.id } }}
                  className="link min-h-11 content-center text-caption font-medium"
                >
                  {t("edit")}
                </Link>
                <Link
                  href={{
                    pathname: "/arbre/[personne]",
                    params: { personne: p.slug },
                  }}
                  className="link min-h-11 content-center text-caption text-ink-muted"
                >
                  {t("sheet")}
                </Link>
              </li>
            ))}
          </ul>
          {list.length > shown && (
            <div>
              <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>
                {t("more", { count: list.length - shown })}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-ink-muted">{t("none")}</p>
      )}
    </div>
  );
}
