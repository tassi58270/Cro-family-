"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useTranslations } from "next-intl";
import { select } from "d3-selection";
import "d3-transition";
import {
  zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import {
  ShieldArt,
  builtInArms,
  type BuiltInArms,
} from "@/components/heraldique/shield";
import type { TreeData } from "@/lib/data/tree";
import {
  CARD_H,
  CARD_W,
  PARTNER_GAP,
  type BranchNode,
  type Graph,
  type Layout,
} from "@/lib/genealogie/layout";
import { personLabel, personYears } from "@/lib/genealogie/tree-model";

/**
 * The drawing of the tree: cards and links in one SVG, moved with d3-zoom
 * (wheel, pinch, drag). Only what is near the screen is drawn, and cards are
 * reduced to their colour when zoomed far out, so that the tree stays fluid
 * with thousands of people. Arrow keys go from card to card.
 */

export type Scene =
  | {
      kind: "people";
      layout: Layout;
      /** Where the button that shows more relatives sits. */
      more: "below" | "above" | null;
      /** The root has parents that are not drawn (descendants view). */
      rootUp: boolean;
      root: number;
    }
  | {
      kind: "branches";
      nodes: BranchNode[];
      edges: { from: number; to: number; d: string }[];
      bounds: Layout["bounds"];
    };

export type CanvasApi = {
  /** Moves the view to a card. `align` places it in the screen. */
  flyTo: (
    person: number,
    options?: { align?: "center" | "top" | "bottom"; instant?: boolean },
  ) => void;
  /** Shows the whole drawing; when it would be too small to read, goes to `fallback` instead. */
  fit: (options?: {
    instant?: boolean;
    fallback?: { person: number; align: "center" | "top" | "bottom" };
  }) => void;
  zoomBy: (factor: number) => void;
  focusCard: (person: number) => void;
};

type Props = {
  data: TreeData;
  graph: Graph;
  scene: Scene;
  locale: string;
  selected: number | null;
  /** People on the highlighted path (« Quel est le lien ? », demonstration). */
  path: ReadonlySet<number> | null;
  /** Lit by the time slider and the filters. */
  isLit: (person: number) => boolean;
  extinctEnds: ReadonlyMap<number, number>;
  branchCounts: number[];
  /** Space taken on the right by the open sheet, to centre in what is left. */
  rightInset: number;
  /** Space taken on the left by the demonstration card. */
  leftInset?: number;
  onOpen: (person: number) => void;
  onToggle: (person: number) => void;
  onRootUp: () => void;
  onOpenBranch: (branch: number) => void;
  ref?: Ref<CanvasApi>;
};

const FAR = 0.42;
const MAX_LINE = 19;
const ACCENT = `M6 0.5H3.5Q0.5 0.5 0.5 3.5V${CARD_H - 3.5}Q0.5 ${CARD_H - 0.5} 3.5 ${CARD_H - 0.5}H6Z`;

/** Splits a name over two lines of about MAX_LINE characters. */
function wrap(text: string): [string, string?] {
  if (text.length <= MAX_LINE) return [text];
  const words = text.split(" ");
  let first = "";
  while (words.length && `${first} ${words[0]}`.trim().length <= MAX_LINE) {
    first = `${first} ${words.shift()}`.trim();
  }
  if (!first) first = words.shift() ?? "";
  let second = words.join(" ");
  if (second.length > MAX_LINE)
    second = `${second.slice(0, MAX_LINE - 1).trimEnd()}…`;
  return [first, second || undefined];
}

function dash(certainty: number) {
  return certainty === 2 ? "1 5" : certainty === 1 ? "7 5" : undefined;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const translate = (x: number, y: number) => ({
  transform: `translate(${x}px, ${y}px)`,
});

type View = { x0: number; y0: number; x1: number; y1: number; far: boolean };

// Each new layout redraws its links, which then fade in.
const versions = new WeakMap<object, number>();
let lastVersion = 0;
function versionOf(scene: object) {
  if (!versions.has(scene)) versions.set(scene, ++lastVersion);
  return versions.get(scene)!;
}

export function TreeCanvas({
  data,
  graph,
  scene,
  locale,
  selected,
  path,
  isLit,
  extinctEnds,
  branchCounts,
  rightInset,
  leftInset = 0,
  onOpen,
  onToggle,
  onRootUp,
  onOpenBranch,
  ref,
}: Props) {
  const t = useTranslations("tree");
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transform = useRef<ZoomTransform>(zoomIdentity);
  const sizeRef = useRef({ width: 0, height: 0 });
  const pending = useRef<(() => void) | null>(null);
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const frame = useRef(0);
  const [active, setActive] = useState<number | null>(null);

  const positions = useMemo(() => {
    if (scene.kind === "people") return scene.layout.positions;
    return new Map(scene.nodes.map((n) => [n.branch, { x: n.x, y: n.y }]));
  }, [scene]);
  const bounds = scene.kind === "people" ? scene.layout.bounds : scene.bounds;
  const latest = useRef({ positions, bounds, rightInset, leftInset });
  useLayoutEffect(() => {
    latest.current = { positions, bounds, rightInset, leftInset };
  });

  const updateView = useCallback((force = false) => {
    const { width, height } = sizeRef.current;
    if (!width || !height) return;
    const tr = transform.current;
    const visible = {
      x0: -tr.x / tr.k,
      y0: -tr.y / tr.k,
      x1: (width - tr.x) / tr.k,
      y1: (height - tr.y) / tr.k,
    };
    const far = tr.k < FAR;
    const current = viewRef.current;
    const area = (v: { x0: number; y0: number; x1: number; y1: number }) =>
      (v.x1 - v.x0) * (v.y1 - v.y0);
    const stale =
      force ||
      !current ||
      current.far !== far ||
      visible.x0 < current.x0 ||
      visible.y0 < current.y0 ||
      visible.x1 > current.x1 ||
      visible.y1 > current.y1 ||
      area(current) > 9 * area(visible);
    if (!stale) return;
    const mx = (visible.x1 - visible.x0) * 0.5;
    const my = (visible.y1 - visible.y0) * 0.5;
    const next = {
      x0: visible.x0 - mx,
      y0: visible.y0 - my,
      x1: visible.x1 + mx,
      y1: visible.y1 + my,
      far,
    };
    viewRef.current = next;
    setView(next);
  }, []);

  useEffect(() => {
    const svg = svgRef.current!;
    const behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.04, 2.5])
      .on("zoom", (event: { transform: ZoomTransform }) => {
        transform.current = event.transform;
        groupRef.current?.setAttribute("transform", event.transform.toString());
        if (!frame.current) {
          frame.current = requestAnimationFrame(() => {
            frame.current = 0;
            updateView();
          });
        }
      });
    zoomRef.current = behaviour;
    select(svg).call(behaviour).on("dblclick.zoom", null);
    const observer = new ResizeObserver(([entry]) => {
      sizeRef.current = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      updateView(true);
      if (pending.current && entry.contentRect.width) {
        const run = pending.current;
        pending.current = null;
        run();
      }
    });
    observer.observe(svg);
    return () => {
      observer.disconnect();
      select(svg).on(".zoom", null);
      cancelAnimationFrame(frame.current);
    };
  }, [updateView]);

  const move = useCallback((target: ZoomTransform, instant?: boolean) => {
    const svg = svgRef.current;
    const behaviour = zoomRef.current;
    if (!svg || !behaviour) return;
    const selection = select(svg);
    if (instant || prefersReducedMotion()) {
      selection.interrupt().call(behaviour.transform, target);
    } else {
      selection
        .interrupt()
        .transition()
        .duration(600)
        .call(behaviour.transform, target);
    }
  }, []);

  const api = useMemo<CanvasApi>(() => {
    // Before the first measure, the request waits for the size.
    const whenSized = (run: () => void) => {
      if (sizeRef.current.width) run();
      else pending.current = run;
    };
    return {
      flyTo(person, options = {}) {
        whenSized(() => {
          const p = latest.current.positions.get(person);
          if (!p) return;
          const { width, height } = sizeRef.current;
          const k = Math.min(
            1.2,
            Math.max(transform.current.k, width < 640 ? 0.72 : 0.9),
          );
          const { leftInset: left, rightInset: right } = latest.current;
          const cx = left + (width - left - right) / 2;
          const cy =
            options.align === "top"
              ? CARD_H + 56
              : options.align === "bottom"
                ? height - CARD_H - 72
                : height / 2;
          move(
            zoomIdentity.translate(cx - p.x * k, cy - p.y * k).scale(k),
            options.instant,
          );
        });
      },
      fit({ instant, fallback } = {}) {
        whenSized(() => {
          const { width, height } = sizeRef.current;
          const {
            bounds: b,
            leftInset: left,
            rightInset: right,
          } = latest.current;
          const usable = width - left - right;
          const w = b.maxX - b.minX + 80;
          const h = b.maxY - b.minY + 160;
          const k = Math.min(
            1,
            Math.max(0.04, Math.min(usable / w, height / h)),
          );
          if (fallback && k < (width < 640 ? 0.5 : 0.62)) {
            this.flyTo(fallback.person, { align: fallback.align, instant });
            return;
          }
          const cx = (b.minX + b.maxX) / 2;
          const cy = (b.minY + b.maxY) / 2;
          move(
            zoomIdentity
              .translate(left + usable / 2 - cx * k, height / 2 - cy * k)
              .scale(k),
            instant,
          );
        });
      },
      zoomBy(factor) {
        const svg = svgRef.current;
        if (!svg || !zoomRef.current) return;
        const selection = select(svg);
        if (prefersReducedMotion()) zoomRef.current.scaleBy(selection, factor);
        else
          zoomRef.current.scaleBy(selection.transition().duration(240), factor);
      },
      focusCard(person) {
        setActive(person);
        requestAnimationFrame(() => {
          svgRef.current
            ?.querySelector<SVGGElement>(`[data-card="${person}"]`)
            ?.focus({ preventScroll: true });
        });
      },
    };
  }, [move]);
  useImperativeHandle(ref, () => api, [api]);

  // A new layout keeps the keyboard position when that person is still drawn.
  const activeCard = active !== null && positions.has(active) ? active : null;
  const entryCard =
    activeCard ??
    (scene.kind === "people" ? scene.root : (scene.nodes[0]?.branch ?? null));

  const inView = (x0: number, y0: number, x1: number, y1: number) =>
    !view || (x1 >= view.x0 && x0 <= view.x1 && y1 >= view.y0 && y0 <= view.y1);
  const far = view?.far ?? false;

  function branchStroke(branch: number) {
    const b = data.branches[branch];
    if (!b) return "var(--hairline-strong)";
    if (b.extinct) return "var(--branch-extinct)";
    return b.color ?? `var(--branch-${branch % 6})`;
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (entryCard === null) return;
    const here = positions.get(entryCard);
    if (!here) return;
    const keys: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const direction = keys[event.key];
    if (direction) {
      event.preventDefault();
      let best: number | null = null;
      let bestScore = Infinity;
      for (const [person, p] of positions) {
        if (person === entryCard) continue;
        const dx = p.x - here.x;
        const dy = p.y - here.y;
        const ahead = direction[0]
          ? dx * direction[0] > 1 && Math.abs(dy) < CARD_H
          : dy * direction[1] > 1;
        if (!ahead) continue;
        const score = direction[0]
          ? Math.abs(dx)
          : Math.abs(dy) * 4 + Math.abs(dx);
        if (score < bestScore) {
          best = person;
          bestScore = score;
        }
      }
      if (best !== null) {
        api.focusCard(best);
        const p = positions.get(best)!;
        const tr = transform.current;
        const sx = p.x * tr.k + tr.x;
        const sy = p.y * tr.k + tr.y;
        const { width, height } = sizeRef.current;
        const outside =
          sx < CARD_W / 2 ||
          sx > width - rightInset - CARD_W / 2 ||
          sy < CARD_H ||
          sy > height - CARD_H;
        if (outside) api.flyTo(best);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (scene.kind === "branches") onOpenBranch(entryCard);
      else onOpen(entryCard);
    } else if (
      (event.key === "+" || event.key === "-") &&
      scene.kind === "people"
    ) {
      const node = scene.layout.nodes.find(
        (n) => n.person === entryCard && !n.repeat,
      );
      if (
        node &&
        ((event.key === "+" && node.more) || (event.key === "-" && node.open))
      ) {
        event.preventDefault();
        onToggle(entryCard);
      }
    }
  }

  const symbols = useMemo(
    () =>
      data.arms.map((a, i) => {
        const builtin =
          a.builtin && (builtInArms as readonly string[]).includes(a.builtin)
            ? (a.builtin as BuiltInArms)
            : undefined;
        return (
          <symbol key={i} id={`tree-arms-${i}`} viewBox="0 0 100 120">
            {a.url && !builtin ? (
              <image
                href={a.url}
                width="100"
                height="120"
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <ShieldArt arms={builtin} scalingStroke />
            )}
          </symbol>
        );
      }),
    [data.arms],
  );

  /** A person's card, centred on (cx, cy) in the coordinates of its block. */
  function card(
    person: number,
    cx: number,
    cy: number,
    role: "main" | "partner",
    repeat = false,
  ) {
    const p = data.people[person];
    const lit = isLit(person);
    const onPath = path?.has(person) ?? false;
    const isSelected = selected === person;
    const arms =
      role === "partner" && p.originArms >= 0 ? p.originArms : p.arms;
    const stroke = branchStroke(p.branch);
    const style = {
      ...translate(cx - CARD_W / 2, cy - CARD_H / 2),
      opacity: lit ? 1 : 0.26,
    };

    if (far) {
      return (
        <g key={`${role}-${person}`} className="tree-card-far" style={style}>
          <rect
            width={CARD_W}
            height={CARD_H}
            rx={8}
            fill={isSelected || onPath ? "var(--croy)" : "var(--paper)"}
            stroke={stroke}
            strokeWidth={10}
          />
        </g>
      );
    }

    const name = p.hidden ? t("living") : personLabel(p) || "—";
    const years = p.hidden ? "" : personYears(p, locale);
    const label = [
      name,
      years,
      p.branch >= 0 ? data.branches[p.branch]?.name : null,
    ]
      .filter(Boolean)
      .join(", ");
    const [line1, line2] = wrap(name);
    const textX = arms >= 0 && !p.hidden ? 40 : 16;
    return (
      <g
        key={`${role}-${person}`}
        data-card={repeat ? undefined : person}
        className="tree-card"
        style={style}
        role="button"
        tabIndex={entryCard === person && !repeat && role === "main" ? 0 : -1}
        aria-label={repeat ? t("card.repeat", { name: label }) : label}
        aria-current={isSelected ? "true" : undefined}
        onClick={() => onOpen(person)}
        onFocus={() => setActive(person)}
      >
        <rect
          className="tree-card-bg"
          width={CARD_W}
          height={CARD_H}
          rx={6}
          fill={p.hidden ? "var(--paper-2)" : "var(--paper)"}
          stroke={
            isSelected || onPath ? "var(--croy)" : "var(--hairline-strong)"
          }
          strokeWidth={isSelected ? 2.5 : onPath ? 2 : 1}
          strokeDasharray={p.hidden || repeat ? "4 4" : undefined}
        />
        <path
          d={ACCENT}
          fill={p.branch >= 0 ? stroke : "var(--hairline-strong)"}
        />
        {arms >= 0 && !p.hidden && (
          <use
            href={`#tree-arms-${arms}`}
            x={14}
            y={CARD_H / 2 - 11}
            width={18}
            height={21.6}
          />
        )}
        <text
          x={textX}
          y={line2 ? 23 : years ? 28 : 37}
          className="font-sans"
          fontSize={13.5}
          fontWeight={p.hidden ? 400 : 600}
          fill={p.hidden || repeat ? "var(--ink-muted)" : "var(--ink)"}
        >
          {line1}
          {line2 && (
            <tspan x={textX} dy={16}>
              {line2}
            </tspan>
          )}
        </text>
        {years && (
          <text
            x={textX}
            y={line2 ? 55 : 46}
            className="tabular font-sans"
            fontSize={12}
            fill="var(--ink-muted)"
          >
            {years}
          </text>
        )}
        {p.portrait && (
          <circle cx={CARD_W - 12} cy={12} r={3} fill="var(--croy)" />
        )}
      </g>
    );
  }

  function roundButton(
    key: string,
    x: number,
    y: number,
    label: string,
    onPress: () => void,
    glyph: ReactNode,
    filled = false,
  ) {
    return (
      <g
        key={key}
        className="tree-toggle"
        style={translate(x, y)}
        role="button"
        tabIndex={-1}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onPress();
        }}
      >
        <title>{label}</title>
        <circle r={18} fill="transparent" />
        <circle
          r={11}
          fill={filled ? "var(--ink)" : "var(--paper)"}
          stroke="var(--ink)"
          strokeWidth={1.2}
        />
        {glyph}
      </g>
    );
  }

  function peopleContent(s: Extract<Scene, { kind: "people" }>) {
    return (
      <>
        <g
          key={versionOf(s)}
          className="tree-edges"
          fill="none"
          strokeLinecap="round"
        >
          {s.layout.edges.map((e) => {
            const a = positions.get(e.from);
            const b = positions.get(e.to);
            if (
              a &&
              b &&
              !inView(
                Math.min(a.x, b.x) - CARD_W,
                Math.min(a.y, b.y),
                Math.max(a.x, b.x) + CARD_W,
                Math.max(a.y, b.y),
              )
            ) {
              return null;
            }
            const lit = isLit(e.from) && isLit(e.to);
            const onPath = path?.has(e.from) && path.has(e.to);
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={e.d}
                stroke={
                  onPath
                    ? "var(--croy)"
                    : branchStroke(data.people[e.to].branch)
                }
                strokeWidth={onPath ? 3 : 1.6}
                strokeDasharray={dash(e.certainty)}
                vectorEffect="non-scaling-stroke"
                style={{ opacity: lit ? 1 : 0.22 }}
              />
            );
          })}
        </g>
        {s.layout.nodes.map((n) => {
          const half = n.width / 2;
          if (
            !inView(
              n.x - half,
              n.y - CARD_H / 2 - 32,
              n.x + half,
              n.y + CARD_H / 2 + 32,
            ) &&
            n.person !== activeCard &&
            n.person !== selected
          ) {
            return null;
          }
          // Block coordinates: (0, 0) is the centre of the block.
          const personX = -half + CARD_W / 2;
          const hasMore = n.more || n.open;
          const end = extinctEnds.get(n.person);
          const person = data.people[n.person];
          const name = person.hidden ? t("living") : personLabel(person);
          const count =
            s.more === "below"
              ? graph.children[n.person].length
              : graph.parents[n.person].length;
          return (
            <g
              key={
                n.repeat
                  ? `repeat-${n.person}-${n.x}-${n.y}`
                  : `node-${n.person}`
              }
              className="tree-node"
              style={translate(n.x, n.y)}
            >
              {n.partners.map((partner, k) => {
                const px =
                  -half + (k + 1) * (CARD_W + PARTNER_GAP) + CARD_W / 2;
                return (
                  <g key={partner}>
                    <line
                      x1={px - CARD_W / 2 - PARTNER_GAP}
                      x2={px - CARD_W / 2}
                      y1={0}
                      y2={0}
                      stroke="var(--ink-muted)"
                      strokeWidth={1.2}
                    />
                    {n.partners.length > 1 && !far && (
                      <text
                        x={px - CARD_W / 2 - PARTNER_GAP / 2}
                        y={-6}
                        textAnchor="middle"
                        fontSize={10}
                        className="tabular font-sans"
                        fill="var(--ink-muted)"
                      >
                        {k + 1}
                      </text>
                    )}
                    {card(partner, px, 0, "partner")}
                  </g>
                );
              })}
              {card(n.person, personX, 0, "main", n.repeat)}
              {!far &&
                hasMore &&
                s.more &&
                roundButton(
                  "toggle",
                  personX,
                  s.more === "below" ? CARD_H / 2 + 14 : -CARD_H / 2 - 14,
                  n.open
                    ? t("card.collapse", { name })
                    : s.more === "above"
                      ? t("card.showParents", { name })
                      : t("card.showChildren", { name, count }),
                  () => onToggle(n.person),
                  <text
                    textAnchor="middle"
                    dy="0.36em"
                    fontSize={n.open ? 15 : 11}
                    fontWeight={600}
                    className="tabular font-sans"
                    fill={n.open ? "var(--ink)" : "var(--paper)"}
                  >
                    {n.open ? "−" : count > 9 ? "9+" : `+${count}`}
                  </text>,
                  !n.open,
                )}
              {!far && end !== undefined && !n.open && (
                <g
                  stroke="var(--branch-extinct)"
                  strokeWidth={1.4}
                  aria-hidden="true"
                >
                  <line
                    x1={personX}
                    x2={personX}
                    y1={CARD_H / 2}
                    y2={CARD_H / 2 + 14}
                  />
                  <line
                    x1={personX - 8}
                    x2={personX + 8}
                    y1={CARD_H / 2 + 14}
                    y2={CARD_H / 2 + 14}
                  />
                  {data.branches[end]?.extinctYear && (
                    <text
                      x={personX + 13}
                      y={CARD_H / 2 + 18}
                      stroke="none"
                      fill="var(--ink-muted)"
                      fontSize={11}
                      className="tabular font-sans"
                    >
                      {data.branches[end].extinctYear}
                    </text>
                  )}
                </g>
              )}
              {!far &&
                n.person === s.root &&
                !n.repeat &&
                s.rootUp &&
                roundButton(
                  "up",
                  personX,
                  -CARD_H / 2 - 18,
                  t("card.up"),
                  onRootUp,
                  <path
                    d="M-4 2 0 -3 4 2"
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />,
                )}
            </g>
          );
        })}
      </>
    );
  }

  function branchesContent(s: Extract<Scene, { kind: "branches" }>) {
    return (
      <>
        <g className="tree-edges" fill="none">
          {s.edges.map((e) => (
            <path
              key={`${e.from}-${e.to}`}
              d={e.d}
              stroke={branchStroke(e.to)}
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        {s.nodes.map((n) => {
          const b = data.branches[n.branch];
          const [line1, line2] = wrap(b.name);
          const status = b.extinct
            ? b.extinctYear
              ? t("branch.extinctIn", { year: b.extinctYear })
              : t("branch.extinct")
            : t("branch.people", { count: branchCounts[n.branch] ?? 0 });
          const textX = b.arms >= 0 ? 40 : 16;
          return (
            <g key={n.branch} className="tree-node" style={translate(n.x, n.y)}>
              <g
                data-card={n.branch}
                className="tree-card"
                style={translate(-CARD_W / 2, -CARD_H / 2)}
                role="button"
                tabIndex={entryCard === n.branch ? 0 : -1}
                aria-label={`${b.name}, ${status}`}
                onClick={() => onOpenBranch(n.branch)}
                onFocus={() => setActive(n.branch)}
              >
                <rect
                  className="tree-card-bg"
                  width={CARD_W}
                  height={CARD_H}
                  rx={6}
                  fill="var(--paper)"
                  stroke="var(--hairline-strong)"
                />
                <path d={ACCENT} fill={branchStroke(n.branch)} />
                {b.arms >= 0 && (
                  <use
                    href={`#tree-arms-${b.arms}`}
                    x={14}
                    y={CARD_H / 2 - 11}
                    width={18}
                    height={21.6}
                  />
                )}
                <text
                  x={textX}
                  y={line2 ? 24 : 29}
                  className="font-display"
                  fontSize={15.5}
                  fontWeight={500}
                  fill="var(--ink)"
                >
                  {line1}
                  {line2 && (
                    <tspan x={textX} dy={16}>
                      {line2}
                    </tspan>
                  )}
                </text>
                <text
                  x={textX}
                  y={line2 ? 56 : 47}
                  className="tabular font-sans"
                  fontSize={12}
                  fill="var(--ink-muted)"
                >
                  {status}
                </text>
              </g>
              {b.extinct && (
                <g
                  stroke="var(--branch-extinct)"
                  strokeWidth={1.4}
                  aria-hidden="true"
                >
                  <line x1={0} x2={0} y1={CARD_H / 2} y2={CARD_H / 2 + 14} />
                  <line
                    x1={-8}
                    x2={8}
                    y1={CARD_H / 2 + 14}
                    y2={CARD_H / 2 + 14}
                  />
                </g>
              )}
            </g>
          );
        })}
      </>
    );
  }

  return (
    <svg
      ref={svgRef}
      className="tree-canvas size-full touch-none select-none"
      role="group"
      aria-label={t("canvas.label")}
      aria-describedby="tree-keys"
      onKeyDown={onKeyDown}
    >
      <defs>{symbols}</defs>
      <g ref={groupRef}>
        {/* Another root or view starts afresh; opening a branch moves the cards. */}
        <g
          key={
            scene.kind === "people" ? `${scene.more}-${scene.root}` : "branches"
          }
        >
          {scene.kind === "people"
            ? peopleContent(scene)
            : branchesContent(scene)}
        </g>
      </g>
    </svg>
  );
}
