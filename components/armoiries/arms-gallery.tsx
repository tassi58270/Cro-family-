"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Shield,
  builtInArms,
  type BuiltInArms,
} from "@/components/heraldique/shield";
import { SidePanel } from "@/components/ui/side-panel";
import type { ArmsItem } from "@/lib/data/arms";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

/**
 * A gallery of coats of arms (6.3): image, blazon, plain explanation, period
 * and bearers. Pick one to compare: hovering another one then shows in red
 * where the two differ, and picking it opens both side by side.
 */

const W = 200;
const H = 240;

function builtin(item: ArmsItem): BuiltInArms | undefined {
  return item.builtin &&
    (builtInArms as readonly string[]).includes(item.builtin)
    ? (item.builtin as BuiltInArms)
    : undefined;
}

export function ArmsImage({
  item,
  className,
}: {
  item: ArmsItem;
  className?: string;
}) {
  if (item.url && !builtin(item)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an SVG drawn by the family, already sharp at any size.
      <img
        src={item.url}
        alt={item.name}
        className={cn("block aspect-[5/6] object-contain", className)}
      />
    );
  }
  return (
    <Shield arms={builtin(item)} label={item.name} className={className} />
  );
}

/** Draws the arms shown in `box` on a canvas, colours resolved. */
async function rasterize(box: HTMLElement): Promise<ImageData | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const svg = box.querySelector("svg");
  const img = box.querySelector("img");
  let source: HTMLImageElement;
  if (svg) {
    const styles = getComputedStyle(document.documentElement);
    const markup = new XMLSerializer()
      .serializeToString(svg)
      .replace(
        /var\((--[\w-]+)\)/g,
        (_, name: string) => styles.getPropertyValue(name).trim() || "#000",
      )
      .replace("<svg", `<svg width="${W}" height="${H}"`);
    source = new Image();
    source.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  } else if (img) {
    source = new Image();
    source.crossOrigin = "anonymous";
    source.src = img.src;
  } else {
    return null;
  }
  try {
    await source.decode();
  } catch {
    return null;
  }
  context.drawImage(source, 0, 0, W, H);
  return context.getImageData(0, 0, W, H);
}

/** An image where the pixels that differ are red, the rest transparent. */
async function differences(
  a: HTMLElement,
  b: HTMLElement,
): Promise<string | null> {
  const [x, y] = await Promise.all([rasterize(a), rasterize(b)]);
  if (!x || !y) return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d")!;
  const out = context.createImageData(W, H);
  const red =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--croy")
      .trim() || "#c8102e";
  const [r, g, bl] = [1, 3, 5].map((i) => parseInt(red.slice(i, i + 2), 16));
  let any = false;
  for (let i = 0; i < x.data.length; i += 4) {
    const delta =
      Math.abs(x.data[i] - y.data[i]) +
      Math.abs(x.data[i + 1] - y.data[i + 1]) +
      Math.abs(x.data[i + 2] - y.data[i + 2]) +
      Math.abs(x.data[i + 3] - y.data[i + 3]);
    if (delta > 80) {
      out.data.set([r, g, bl, 210], i);
      any = true;
    }
  }
  if (!any) return null;
  context.putImageData(out, 0, 0);
  return canvas.toDataURL();
}

function Facts({ item }: { item: ArmsItem }) {
  const t = useTranslations("armsPage.gallery");
  const period = [item.periodStart, item.periodEnd].filter(Boolean).join("–");
  return (
    <div className="grid min-w-0 content-start gap-2">
      <h3 className="font-display text-title-sm">{item.name}</h3>
      {(period || item.familyName) && (
        <p className="tabular text-caption text-ink-muted">
          {[period, item.familyName && t("family", { name: item.familyName })]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {item.blazon && (
        <p className="font-display text-[1.125rem] leading-snug">
          {item.blazon}
        </p>
      )}
      {item.explanation && <p className="text-ink-muted">{item.explanation}</p>}
      {(item.bearers || item.branch || item.person) && (
        <p className="text-caption">
          <span className="font-medium">{t("bearers")} </span>
          {item.bearers}
          {item.branch && (
            <>
              {item.bearers && " · "}
              <Link
                href={{
                  pathname: "/branches/[branche]",
                  params: { branche: item.branch.slug },
                }}
                className="link"
              >
                {item.branch.name}
              </Link>
            </>
          )}
          {item.person?.slug && item.person.name && (
            <>
              {(item.bearers || item.branch) && " · "}
              <Link
                href={{
                  pathname: "/arbre/[personne]",
                  params: { personne: item.person.slug },
                }}
                className="link"
              >
                {item.person.name}
              </Link>
            </>
          )}
        </p>
      )}
      {item.isDemo && (
        <p className="text-caption text-croy-text">{t("demo")}</p>
      )}
    </div>
  );
}

export function ArmsGallery({
  items,
  compact = false,
}: {
  items: ArmsItem[];
  compact?: boolean;
}) {
  const t = useTranslations("armsPage.gallery");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [mask, setMask] = useState<{ key: string; url: string | null } | null>(
    null,
  );
  const boxes = useRef(new Map<string, HTMLElement>());
  const cache = useRef(new Map<string, string | null>());

  const other = pair ? pair[1] : hovered && hovered !== pinned ? hovered : null;
  const first = pair ? pair[0] : pinned;
  const key = first && other ? [first, other].sort().join("|") : null;

  useEffect(() => {
    if (!key || !first || !other) return;
    if (cache.current.has(key)) {
      setMask({ key, url: cache.current.get(key)! });
      return;
    }
    const a = boxes.current.get(first);
    const b = boxes.current.get(other);
    if (!a || !b) return;
    let cancelled = false;
    differences(a, b).then((url) => {
      cache.current.set(key, url);
      if (!cancelled) setMask({ key, url });
    });
    return () => {
      cancelled = true;
    };
  }, [key, first, other]);

  const overlay = mask && mask.key === key ? mask.url : null;
  const byId = (id: string) => items.find((i) => i.id === id)!;

  return (
    <>
      {items.length > 1 && !compact && (
        <p role="status" className="text-caption text-ink-muted">
          {pinned ? t("hint", { name: byId(pinned).name }) : t("intro")}
        </p>
      )}
      <ul
        className={cn(
          "grid gap-x-12 gap-y-12",
          compact ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {items.map((item) => {
          const showMask =
            overlay && (item.id === first || item.id === other) && !pair;
          return (
            <li
              key={item.id}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)] gap-5",
                compact && "items-center",
              )}
              onPointerEnter={() => setHovered(item.id)}
              onPointerLeave={() =>
                setHovered((h) => (h === item.id ? null : h))
              }
              onFocus={() => setHovered(item.id)}
            >
              <div className="grid justify-items-center gap-3">
                <div
                  ref={(el) => {
                    if (el) boxes.current.set(item.id, el);
                  }}
                  className="relative"
                >
                  <ArmsImage
                    item={item}
                    className={compact ? "w-16" : "w-24 md:w-28"}
                  />
                  {showMask && (
                    // eslint-disable-next-line @next/next/no-img-element -- computed in the browser.
                    <img
                      src={overlay}
                      alt=""
                      className="arms-diff pointer-events-none absolute inset-0 size-full object-fill"
                    />
                  )}
                </div>
                {items.length > 1 && !compact && (
                  <button
                    type="button"
                    aria-pressed={pinned === item.id}
                    onClick={() => {
                      if (pinned && pinned !== item.id) {
                        setPair([pinned, item.id]);
                        setPinned(null);
                      } else setPinned(pinned === item.id ? null : item.id);
                    }}
                    className={cn(
                      "min-h-11 rounded-full border px-3 text-caption font-medium transition-[background-color,color,transform] duration-(--duration-fast) active:scale-[0.97]",
                      pinned === item.id
                        ? "border-ink bg-ink text-paper"
                        : "border-hairline-strong hover:border-ink",
                    )}
                  >
                    {pinned && pinned !== item.id
                      ? t("compareWith")
                      : t("compare")}
                  </button>
                )}
              </div>
              {compact ? (
                <div className="grid gap-1">
                  <h3 className="font-display text-[1.25rem] leading-tight">
                    {item.name}
                  </h3>
                  {item.blazon && (
                    <p className="text-caption text-ink-muted">{item.blazon}</p>
                  )}
                </div>
              ) : (
                <Facts item={item} />
              )}
            </li>
          );
        })}
      </ul>

      <SidePanel
        open={pair !== null}
        onClose={() => setPair(null)}
        title={t("panelTitle")}
      >
        {pair && (
          <div className="grid gap-8">
            <p className="text-caption text-ink-muted">
              {overlay ? t("differences") : t("same")}
            </p>
            <div className="grid grid-cols-2 gap-6">
              {pair.map((id) => {
                const item = byId(id);
                return (
                  <figure key={id} className="grid justify-items-center gap-3">
                    <div className="relative">
                      <ArmsImage item={item} className="w-32" />
                      {overlay && (
                        // eslint-disable-next-line @next/next/no-img-element -- computed in the browser.
                        <img
                          src={overlay}
                          alt=""
                          className="arms-diff pointer-events-none absolute inset-0 size-full object-fill"
                        />
                      )}
                    </div>
                    <figcaption className="text-center font-display text-[1.125rem] leading-tight">
                      {item.name}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            {pair.map((id) => {
              const item = byId(id);
              return item.blazon || item.explanation ? (
                <div
                  key={id}
                  className="grid gap-1 border-t border-hairline pt-4"
                >
                  <p className="text-caption font-medium text-ink-muted">
                    {item.name}
                  </p>
                  {item.blazon && (
                    <p className="font-display text-[1.125rem]">
                      {item.blazon}
                    </p>
                  )}
                  {item.explanation && (
                    <p className="text-ink-muted">{item.explanation}</p>
                  )}
                </div>
              ) : null;
            })}
          </div>
        )}
      </SidePanel>
    </>
  );
}
