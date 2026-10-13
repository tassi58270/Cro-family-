"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SHIELD_PATH, ShieldArt } from "@/components/heraldique/shield";
import { Term } from "@/components/ui/term";
import { cn } from "@/lib/design/cn";

/**
 * The first arms explained step by step (cahier des charges, 6.3): the white
 * field, then the three fasces, then the quartering with the axes of Renty.
 * The shield stays in view while the steps scroll past; every heraldic word
 * opens its meaning in plain words.
 */

const STEPS = ["field", "fasces", "quartered"] as const;
const UNIT = 120 / 7;

export function BlazonExplainer() {
  const t = useTranslations("armsPage.explainer");
  const g = useTranslations("glossary");
  const [stage, setStage] = useState(0);
  const steps = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setStage(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-40% 0px -45% 0px" },
    );
    steps.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const terms = {
    argent: (chunks: ReactNode) => (
      <Term definition={g("argent")}>{chunks}</Term>
    ),
    gueules: (chunks: ReactNode) => (
      <Term definition={g("gueules")}>{chunks}</Term>
    ),
    fasce: (chunks: ReactNode) => <Term definition={g("fasce")}>{chunks}</Term>,
    ecartele: (chunks: ReactNode) => (
      <Term definition={g("ecartele")}>{chunks}</Term>
    ),
    doloire: (chunks: ReactNode) => (
      <Term definition={g("doloire")}>{chunks}</Term>
    ),
  };

  return (
    <section
      aria-labelledby="blason"
      className="blazon grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16"
    >
      <div className="sticky top-[calc(var(--header-h)+0.75rem)] z-10 -mx-(--gutter) self-start bg-paper/95 px-(--gutter) py-3 backdrop-blur-md md:top-[calc(var(--header-h)+4rem)] md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex items-center gap-5 md:grid md:justify-items-center md:gap-6">
          <svg
            viewBox="-4 -4 108 128"
            className="w-24 shrink-0 md:w-[min(22rem,80%)]"
            role="img"
            aria-label={t(`shield.${STEPS[stage]}`)}
            data-stage={stage}
          >
            <defs>
              <clipPath id="blazon-clip">
                <path d={SHIELD_PATH} />
              </clipPath>
            </defs>
            <g clipPath="url(#blazon-clip)">
              <rect width="100" height="120" className="blazon-field" />
              <g className="blazon-fasces" fill="var(--croy)">
                {[1, 3, 5].map((i, k) => (
                  <rect
                    key={i}
                    y={i * UNIT}
                    width="100"
                    height={UNIT}
                    style={{ transitionDelay: `${k * 90}ms` }}
                  />
                ))}
              </g>
              <g className="blazon-quartered">
                <ShieldArt arms="croy-renty" scalingStroke />
              </g>
            </g>
            <path
              d={SHIELD_PATH}
              fill="none"
              stroke="var(--croy)"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ol className="flex gap-2 md:hidden" aria-hidden="true">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "h-1 w-6 rounded-full transition-colors duration-(--duration-base)",
                  i <= stage ? "bg-croy" : "bg-hairline-strong",
                )}
              />
            ))}
          </ol>
        </div>
      </div>

      <div className="grid">
        <h2 id="blason" className="font-display text-title">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-xl text-lead text-ink-muted">{t("intro")}</p>
        {STEPS.map((step, i) => (
          <article
            key={step}
            ref={(el) => {
              steps.current[i] = el;
            }}
            data-step={i}
            className={cn(
              "grid content-center gap-3 py-[18svh] transition-colors duration-(--duration-slow) md:min-h-[70svh] md:py-0",
              // Dimmed, but still readable: muted ink rather than transparency.
              stage !== i && "md:text-ink-muted",
            )}
          >
            <p
              className={cn(
                "tabular font-display text-title-sm",
                stage === i
                  ? "text-croy-text"
                  : "text-croy-text md:text-ink-muted",
              )}
            >
              {i + 1}
            </p>
            <h3 className="font-display text-title-sm">{t(`${step}.title`)}</h3>
            <p className="max-w-xl text-lead">
              {t.rich(`${step}.body`, terms)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
