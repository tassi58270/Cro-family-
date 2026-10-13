"use client";

import { useTranslations } from "next-intl";
import type { LineageStep } from "@/lib/data/lineage";
import type { TreeData } from "@/lib/data/tree";
import {
  personLabel,
  personYears,
  type TreeModel,
} from "@/lib/genealogie/tree-model";
import { CertaintyMark, SourceItem } from "./person-sheet";

/**
 * « Voir la démonstration » (6.2): the lineage link by link, from the first
 * person to the last, with the proof of each link. The tree follows along.
 */
export function LineageCard({
  data,
  model,
  lineage,
  steps,
  failed,
  index,
  onStep,
  onClose,
  rightInset,
  locale,
}: {
  locale: string;
  data: TreeData;
  model: TreeModel;
  lineage: TreeData["lineages"][number];
  steps: LineageStep[] | null;
  failed?: boolean;
  index: number;
  onStep: (index: number) => void;
  onClose: () => void;
  rightInset: number;
}) {
  const t = useTranslations("tree.demo");
  const step = steps?.[index];
  const name = (id: string) => {
    const i = model.byId.get(id);
    if (i === undefined) return "";
    const p = data.people[i];
    return p.hidden ? t("living") : personLabel(p);
  };
  const years = (id: string) => {
    const i = model.byId.get(id);
    return i === undefined || data.people[i].hidden
      ? ""
      : personYears(data.people[i], locale);
  };

  return (
    <section
      aria-label={lineage.title || t("button")}
      className="lineage-card absolute inset-x-3 bottom-[4.25rem] z-10 grid max-h-[55%] gap-4 overflow-y-auto rounded-sm border border-hairline bg-paper p-5 shadow-(--shadow-panel) md:top-4 md:right-auto md:bottom-auto md:left-4 md:max-h-[calc(100%-6rem)] md:w-[26rem]"
      style={
        rightInset
          ? { maxWidth: `calc(100% - ${rightInset + 32}px)` }
          : undefined
      }
    >
      <header className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-caption font-medium text-croy-text">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-title-sm">
            {lineage.title || t("button")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-paper-2"
        >
          <span className="sr-only">{t("close")}</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
            <path
              d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      {lineage.intro && (
        <p className="text-caption text-ink-muted">{lineage.intro}</p>
      )}

      {failed ? (
        <p>{t("error")}</p>
      ) : !steps ? (
        <p role="status" className="text-ink-muted">
          {t("loading")}
        </p>
      ) : !steps.length || !step ? (
        <p>{t("notConnected")}</p>
      ) : (
        <div className="grid gap-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <p className="tabular text-caption font-medium">
              {t("step", { n: index + 1, total: steps.length })}
            </p>
            <span
              aria-hidden="true"
              className="h-1 flex-1 overflow-hidden rounded-full bg-paper-2"
            >
              <span
                className="block h-full origin-left bg-croy transition-transform duration-(--duration-base) ease-out"
                style={{ transform: `scaleX(${(index + 1) / steps.length})` }}
              />
            </span>
          </div>
          <ol className="grid gap-1">
            <li className="grid">
              <span className="font-medium">{name(step.parentId)}</span>
              <span className="tabular text-caption text-ink-muted">
                {years(step.parentId)}
              </span>
            </li>
            <li
              aria-hidden="true"
              className="flex items-center gap-2 py-1 pl-1 text-caption text-ink-muted"
            >
              <svg viewBox="0 0 12 20" className="h-5 w-3">
                <path
                  d="M6 1v17M2 14l4 4 4-4"
                  fill="none"
                  stroke="var(--croy)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              {t("parentOf")}
              <CertaintyMark certainty={step.certainty} />
            </li>
            <li className="grid">
              <span className="font-medium">{name(step.childId)}</span>
              <span className="tabular text-caption text-ink-muted">
                {years(step.childId)}
              </span>
            </li>
          </ol>
          <div className="grid gap-3 border-t border-hairline pt-4">
            <h3 className="text-caption font-medium text-ink-muted">
              {t("proofs")}
            </h3>
            {step.sources.length ? (
              <ul className="grid gap-4">
                {step.sources.map((s) => (
                  <SourceItem key={s.id} source={s} />
                ))}
              </ul>
            ) : (
              <p className="text-caption">{t("noProof")}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onStep(index - 1)}
              className="min-h-11 flex-1 rounded-full border border-hairline-strong px-4 text-caption font-medium transition-transform duration-(--duration-press) active:scale-[0.97] disabled:opacity-40"
            >
              {t("previous")}
            </button>
            <button
              type="button"
              disabled={index === steps.length - 1}
              onClick={() => onStep(index + 1)}
              className="min-h-11 flex-1 rounded-full bg-ink px-4 text-caption font-medium text-paper transition-transform duration-(--duration-press) active:scale-[0.97] disabled:opacity-40"
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
