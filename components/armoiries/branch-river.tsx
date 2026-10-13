"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BranchItem } from "@/lib/data/arms";
import { cn } from "@/lib/design/cn";
import { layoutRiver } from "@/lib/genealogie/river";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { branchColor } from "./branch-color";

/**
 * The branches as a river (6.3): from the Picard source down to today's
 * branches, each line as thick as its number of people; extinct branches
 * stop with a bar and their year. The numbered list beside it is the
 * readable version, and each entry leads to the branch.
 */

export function BranchRiver({ branches }: { branches: BranchItem[] }) {
  const t = useTranslations("armsPage.river");
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const now = new Date().getFullYear();
  const river = useMemo(
    () =>
      layoutRiver(
        branches.map((b) => ({
          key: b.slug,
          parent: b.parent,
          start: b.start,
          end: b.extinct
            ? (b.extinctMale ?? b.extinctFemale ?? b.start ?? null)
            : null,
          people: b.people,
        })),
        now,
      ),
    [branches, now],
  );
  const bySlug = new Map(branches.map((b, i) => [b.slug, { b, i }]));
  const ordered = river.streams.map((s) => ({ s, ...bySlug.get(s.key)! }));

  return (
    <div className="river grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
      <div className="-mx-(--gutter) [scrollbar-width:thin] overflow-x-auto px-(--gutter)">
        <svg
          viewBox={`0 0 ${river.width} ${river.height}`}
          className="h-auto"
          // Never larger than 1.4 times its drawing, so that a few branches stay small.
          style={{
            width: river.width * 1.4,
            maxWidth: "100%",
            minWidth: Math.min(river.width, 640) * 0.62,
          }}
          aria-hidden="true"
        >
          {river.ticks.map((tick) => (
            <g key={tick.year}>
              <line
                x1={52}
                x2={river.width}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--hairline)"
              />
              <text
                x={44}
                y={tick.y + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--ink-muted)"
                className="tabular font-sans"
              >
                {tick.year}
              </text>
            </g>
          ))}
          <text
            x={river.width - 4}
            y={river.height - 18}
            textAnchor="end"
            fontSize={12}
            fill="var(--ink-muted)"
            className="font-sans"
          >
            {t("today")}
          </text>
          {ordered.map(({ s, b, i }) => {
            const color = branchColor(b, i);
            return (
              <g
                key={s.key}
                className="river-stream cursor-pointer"
                data-active={active === s.key ? "" : undefined}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() =>
                  setActive((a) => (a === s.key ? null : a))
                }
                onClick={() =>
                  router.push({
                    pathname: "/branches/[branche]",
                    params: { branche: b.slug },
                  })
                }
              >
                <path
                  d={s.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={24}
                />
                <path
                  className="river-line"
                  pathLength={1}
                  d={s.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={s.width}
                  strokeLinecap="round"
                />
                {s.extinct ? (
                  <g stroke="var(--branch-extinct)" strokeWidth={1.6}>
                    <line
                      x1={s.x - 9}
                      x2={s.x + 9}
                      y1={s.bottom + 8}
                      y2={s.bottom + 8}
                    />
                    <text
                      x={s.x}
                      y={s.bottom + 24}
                      textAnchor="middle"
                      fontSize={11}
                      stroke="none"
                      fill="var(--ink-muted)"
                      className="tabular font-sans"
                    >
                      {b.extinctMale ?? b.extinctFemale ?? ""}
                    </text>
                  </g>
                ) : null}
                <circle
                  cx={s.x}
                  cy={s.top}
                  r={11}
                  fill="var(--paper)"
                  stroke={color}
                  strokeWidth={1.6}
                />
                <text
                  x={s.x}
                  y={s.top + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--ink)"
                  className="tabular font-sans"
                >
                  {s.number}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ol className="grid content-start gap-1" aria-label={t("legend")}>
        {ordered.map(({ s, b, i }) => (
          <li key={s.key}>
            <Link
              href={{
                pathname: "/branches/[branche]",
                params: { branche: b.slug },
              }}
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => setActive((a) => (a === s.key ? null : a))}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              className={cn(
                "group grid min-h-12 grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-xs px-2 py-1.5 transition-colors duration-(--duration-fast)",
                active === s.key && "bg-paper-2",
              )}
            >
              <span
                className="tabular grid size-7 place-items-center rounded-full border-[1.5px] text-caption font-semibold"
                style={{ borderColor: branchColor(b, i) }}
              >
                {s.number}
              </span>
              <span className="grid min-w-0">
                <span className="truncate font-medium group-hover:underline">
                  {b.name}
                </span>
                <span className="tabular text-caption text-ink-muted">
                  {[
                    b.start &&
                      (b.extinct
                        ? `${b.start} – ${b.extinctMale ?? b.extinctFemale ?? "?"}`
                        : t("since", { year: b.start })),
                    !b.start && b.extinct && t("extinct"),
                    t("people", { count: b.people }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
