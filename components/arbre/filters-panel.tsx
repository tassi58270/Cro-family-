"use client";

import { useId, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { SidePanel } from "@/components/ui/side-panel";
import type { TreeData } from "@/lib/data/tree";
import {
  NO_FILTERS,
  centuryLabel,
  centuryOf,
  type Filters,
} from "@/lib/genealogie/tree-model";

/**
 * Filters of the tree (6.2): branch, century, title held, with or without a
 * photo. People who do not match stay in place, dimmed, so that the shape of
 * the family is kept.
 */
export function FiltersPanel({
  open,
  onClose,
  data,
  locale,
  filters,
  onChange,
  matching,
}: {
  open: boolean;
  onClose: () => void;
  data: TreeData;
  locale: string;
  filters: Filters;
  onChange: (filters: Filters) => void;
  matching: number;
}) {
  const t = useTranslations("tree.filters");
  const centuries = useMemo(
    () =>
      [
        ...new Set(
          data.people.map(centuryOf).filter((c): c is number => c !== null),
        ),
      ].sort((a, b) => a - b),
    [data],
  );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t("title")}
      footer={
        <>
          <Button onClick={onClose}>{t("show", { count: matching })}</Button>
          <Button variant="ghost" onClick={() => onChange(NO_FILTERS)}>
            {t("clear")}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 pt-2">
        <Choice label={t("branch")}>
          {(id) => (
            <Select
              id={id}
              value={filters.branch}
              onChange={(branch) => onChange({ ...filters, branch })}
              any={t("any")}
              options={data.branches.map((b, i) => [i, b.name])}
            />
          )}
        </Choice>
        <Choice label={t("century")}>
          {(id) => (
            <Select
              id={id}
              value={filters.century}
              onChange={(century) => onChange({ ...filters, century })}
              any={t("any")}
              options={centuries.map((c) => [c, centuryLabel(c, locale)])}
            />
          )}
        </Choice>
        <Choice label={t("titleHeld")}>
          {(id) => (
            <Select
              id={id}
              value={filters.title}
              onChange={(title) => onChange({ ...filters, title })}
              any={t("any")}
              options={data.titles.map((title, i) => [i, title.name])}
            />
          )}
        </Choice>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-caption font-medium">
            {t("photo")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                [null, t("any")],
                ["with", t("withPhoto")],
                ["without", t("withoutPhoto")],
              ] as const
            ).map(([value, label]) => (
              <FilterChip
                key={label}
                pressed={filters.photo === value}
                onClick={() => onChange({ ...filters, photo: value })}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </fieldset>
      </div>
    </SidePanel>
  );
}

function Choice({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-caption font-medium">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  any,
  options,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  any: string;
  options: [number, string][];
}) {
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
      disabled={!options.length}
      className="min-h-12 w-full rounded-sm border border-hairline-strong bg-paper px-3 text-ink focus:border-ink focus:outline-none disabled:text-ink-muted"
    >
      <option value="">{any}</option>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
