"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { FilterChip } from "@/components/ui/chip";
import { SidePanel } from "@/components/ui/side-panel";
import type { LineageStep } from "@/lib/data/lineage";
import type { PersonDetail, Relative } from "@/lib/data/person";
import type { TreeData } from "@/lib/data/tree";
import { cn } from "@/lib/design/cn";
import {
  layoutAncestors,
  layoutBranches,
  layoutDescendants,
  layoutPath,
} from "@/lib/genealogie/layout";
import {
  findRelationship,
  relationshipLabel,
} from "@/lib/genealogie/relationship";
import {
  NO_FILTERS,
  activeFilterCount,
  aliveIn,
  buildModel,
  chainTo,
  defaultRoot,
  extinctEnds,
  matchesFilters,
  personLabel,
  type Filters,
} from "@/lib/genealogie/tree-model";
import { Link } from "@/lib/i18n/navigation";
import { FiltersPanel } from "./filters-panel";
import { LineageCard } from "./lineage-card";
import { PersonList } from "./person-list";
import { PersonSearch } from "./person-search";
import { PersonSheet } from "./person-sheet";
import { TreeCanvas, type CanvasApi, type Scene } from "./tree-canvas";

/**
 * The family tree page (cahier des charges, 6.2): search at the top, three
 * views (descendants, ancestors, branches) and a list, the time slider, the
 * filters, « Quel est le lien ? », « Me retrouver » and the demonstration of
 * a lineage. The state lives in the address, so that a view can be shared.
 */

type View = "descendants" | "ancestors" | "branches" | "path" | "list";

const VIEW_PARAM: Record<View, string> = {
  descendants: "descendance",
  ancestors: "ascendance",
  branches: "branches",
  path: "lien",
  list: "liste",
};

const DEPTHS = [2, 3, 4, 5, 6, 8, 12];
const PANEL_WIDTH = 512;

type Align = "center" | "top" | "bottom";

type Frame =
  | { person: number; align?: Align }
  | { fit: true; fallback?: { person: number; align: Align } };

type Sheet = { person: number; detail: PersonDetail | null; failed?: boolean };

type Demo = {
  lineage: number;
  steps: LineageStep[] | null;
  index: number;
  failed?: boolean;
};

export function TreeApp({
  locale,
  empty,
}: {
  locale: string;
  empty: ReactNode;
}) {
  const t = useTranslations("tree");
  const [data, setData] = useState<TreeData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [desktop, setDesktop] = useState(false);

  const [view, setView] = useState<View>("descendants");
  const [root, setRoot] = useState(0);
  const [depth, setDepth] = useState(3);
  const [toggled, setToggled] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [link, setLink] = useState<{
    a: number | null;
    b: number | null;
  } | null>(null);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ request: Frame; token: number } | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  const canvas = useRef<CanvasApi>(null);
  const details = useRef(new Map<number, PersonDetail>());
  const backTo = useRef<View>("descendants");
  const shell = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<number | null>(null);

  // The tree fills the screen below the menu and the demonstration banner.
  useLayoutEffect(() => {
    const measure = () => {
      const top = shell.current?.getBoundingClientRect().top;
      if (top !== undefined) setOffset(Math.round(top + window.scrollY));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [status]);

  // ── Loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    const member = document.cookie
      .split("; ")
      .some((c) => c.startsWith("croy_membre="));
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    let cancelled = false;
    const load = async () => {
      if (member) {
        const response = await fetch(`/api/arbre/${locale}/membres`, {
          cache: "no-store",
        });
        if (response.ok)
          return { tree: (await response.json()) as TreeData, member: true };
      }
      const response = await fetch(`/api/arbre/${locale}`);
      if (!response.ok) throw new Error(String(response.status));
      return { tree: (await response.json()) as TreeData, member: false };
    };
    load()
      .then(({ tree, member: asMember }) => {
        if (cancelled) return;
        setSignedIn(asMember);
        setData(tree);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      media.removeEventListener("change", sync);
    };
  }, [locale, attempt]);

  const model = useMemo(() => (data ? buildModel(data) : null), [data]);
  const startRoot = useMemo(
    () => (data && model ? defaultRoot(data, model) : 0),
    [data, model],
  );
  const ends = useMemo(
    () =>
      data && model
        ? extinctEnds(data, model.graph)
        : new Map<number, number>(),
    [data, model],
  );
  const branchCounts = useMemo(() => {
    const counts = data ? data.branches.map(() => 0) : [];
    data?.people.forEach((p) => p.branch >= 0 && counts[p.branch]++);
    return counts;
  }, [data]);

  const requestFrame = useCallback((request: Frame) => {
    setFrame((f) => ({ request, token: (f?.token ?? 0) + 1 }));
  }, []);

  // ── Sheet of a person ──────────────────────────────────────────────────
  const openSheet = useCallback(
    (person: number) => {
      if (!data) return;
      setSelected(person);
      const p = data.people[person];
      const cached = details.current.get(person);
      if (cached || p.hidden || !p.slug) {
        setSheet({ person, detail: cached ?? null });
        return;
      }
      setSheet({ person, detail: null });
      fetch(`/api/personne/${encodeURIComponent(p.slug)}?langue=${locale}`, {
        cache: "no-store",
      })
        .then((r) =>
          r.ok ? (r.json() as Promise<PersonDetail>) : Promise.reject(r.status),
        )
        .then((detail) => {
          details.current.set(person, detail);
          setSheet((s) => (s?.person === person ? { person, detail } : s));
        })
        .catch(() =>
          setSheet((s) =>
            s?.person === person ? { person, detail: null, failed: true } : s,
          ),
        );
    },
    [data, locale],
  );

  /**
   * Brings a person into view: opens the branches that lead to them from the
   * current root, or else starts the tree from them.
   */
  const goTo = useCallback(
    (
      person: number,
      options: { sheet?: boolean; align?: "center" | "top" } = {},
    ) => {
      if (!data || !model) return;
      let nextView = view;
      let nextRoot = root;
      let nextToggled = toggled;
      if (view === "branches" || view === "path") {
        nextView = "descendants";
        nextRoot = startRoot;
        nextToggled = new Set();
      }
      if (nextView === "descendants" || nextView === "ancestors") {
        const chain = chainTo(
          model.graph,
          nextRoot,
          person,
          nextView === "ancestors",
        );
        if (chain) {
          const open = new Set(nextToggled);
          chain
            .slice(0, -1)
            .forEach((p, d) => (d < depth ? open.delete(p) : open.add(p)));
          nextToggled = open;
        } else {
          nextRoot = person;
          nextToggled = new Set();
        }
      }
      if (nextView !== "path") {
        setDemo(null);
        setLink(null);
      }
      setView(nextView);
      setRoot(nextRoot);
      setToggled(nextToggled);
      setSelected(person);
      if (nextView !== "list")
        requestFrame({ person, align: options.align ?? "center" });
      if (options.sheet) openSheet(person);
    },
    [
      data,
      model,
      view,
      root,
      toggled,
      depth,
      startRoot,
      requestFrame,
      openSheet,
    ],
  );

  // ── State from and to the address ──────────────────────────────────────
  useEffect(() => {
    if (!data || !model || ready) return;
    const params = new URLSearchParams(window.location.search);
    const fromView = (Object.keys(VIEW_PARAM) as View[]).find(
      (v) => VIEW_PARAM[v] === params.get("vue"),
    );
    const fromRoot = model.bySlug.get(params.get("depuis") ?? "");
    const person = model.bySlug.get(params.get("personne") ?? "");
    const at = Number(params.get("annee"));
    const pair = (params.get("lien") ?? "")
      .split(",")
      .map((s) => model.bySlug.get(s));
    // Applying the address once, after the tree has arrived.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (at > 0) setYear(Math.round(at));
    if (pair.length === 2 && pair[0] !== undefined && pair[1] !== undefined) {
      setLink({ a: pair[0], b: pair[1] });
      setView("path");
      requestFrame({ fit: true });
    } else {
      const v = fromView && fromView !== "path" ? fromView : "descendants";
      const r = fromRoot ?? startRoot;
      setView(v);
      setRoot(r);
      if (person !== undefined && v !== "branches") {
        const chain = chainTo(model.graph, r, person, v === "ancestors");
        if (chain)
          setToggled(new Set(chain.slice(0, -1).filter((_, d) => d >= 3)));
        else setRoot(person);
        setSelected(person);
        openSheet(person);
        requestFrame({ person });
      } else {
        requestFrame(
          v === "branches"
            ? { fit: true }
            : {
                fit: true,
                fallback: {
                  person: r,
                  align: v === "ancestors" ? "bottom" : "top",
                },
              },
        );
      }
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data, model, ready, startRoot, requestFrame, openSheet]);

  useEffect(() => {
    if (!ready || !data) return;
    const params = new URLSearchParams();
    if (view === "path" && link?.a != null && link.b != null && !demo) {
      params.set(
        "lien",
        `${data.people[link.a].slug},${data.people[link.b].slug}`,
      );
    } else if (view !== "descendants" && view !== "path") {
      params.set("vue", VIEW_PARAM[view]);
    }
    if (
      (view === "descendants" || view === "ancestors") &&
      root !== startRoot &&
      data.people[root]?.slug
    ) {
      params.set("depuis", data.people[root].slug!);
    }
    if (sheet && data.people[sheet.person]?.slug)
      params.set("personne", data.people[sheet.person].slug!);
    if (year !== null) params.set("annee", String(year));
    const query = params.toString().replaceAll("%2C", ",");
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [ready, data, view, root, startRoot, sheet, year, link, demo]);

  // ── What is drawn ──────────────────────────────────────────────────────
  const relationship = useMemo(() => {
    if (!model || link?.a == null || link.b == null) return null;
    return findRelationship(model.family, String(link.a), String(link.b));
  }, [model, link]);

  const lineagePath = useMemo(() => {
    if (!demo?.steps?.length || !model) return null;
    const ids = [demo.steps[0].parentId, ...demo.steps.map((s) => s.childId)];
    const path = ids.map((id) => model.byId.get(id));
    return path.every((i) => i !== undefined) ? (path as number[]) : null;
  }, [demo, model]);

  const pathPeople = useMemo(() => {
    if (view !== "path") return null;
    if (demo) return lineagePath;
    return relationship && relationship.kind !== "none"
      ? relationship.path.map(Number)
      : null;
  }, [view, demo, lineagePath, relationship]);

  const scene = useMemo<Scene | null>(() => {
    if (!data || !model || !data.people.length) return null;
    const g = model.graph;
    if (view === "branches")
      return {
        kind: "branches",
        ...layoutBranches(data.branches.map((b) => b.parent)),
      };
    if (view === "path" && pathPeople) {
      return {
        kind: "people",
        layout: layoutPath(pathPeople, g),
        more: null,
        rootUp: false,
        root: pathPeople[0],
      };
    }
    if (view === "ancestors") {
      return {
        kind: "people",
        layout: layoutAncestors(g, root, depth, toggled),
        more: "above",
        rootUp: false,
        root,
      };
    }
    return {
      kind: "people",
      layout: layoutDescendants(g, root, depth, toggled),
      more: "below",
      rootUp: g.parents[root].length > 0,
      root,
    };
  }, [data, model, view, root, depth, toggled, pathPeople]);

  useEffect(() => {
    if (!frame || !canvas.current) return;
    const { request } = frame;
    if ("fit" in request) canvas.current.fit({ fallback: request.fallback });
    else canvas.current.flyTo(request.person, { align: request.align });
  }, [frame, scene]);

  const pathSet = useMemo(
    () => (pathPeople ? new Set(pathPeople) : null),
    [pathPeople],
  );

  const filtering = activeFilterCount(filters) > 0;
  const isLit = useCallback(
    (i: number) => {
      if (!data) return true;
      const p = data.people[i];
      if (year !== null && !aliveIn(p, year)) return false;
      return !filtering || matchesFilters(p, filters);
    },
    [data, year, filters, filtering],
  );

  // ── Actions ────────────────────────────────────────────────────────────
  function switchView(next: View) {
    setDemo(null);
    setLink(null);
    setView(next);
    setToggled(new Set());
    if (next === "branches") requestFrame({ fit: true });
    else if (next !== "list") {
      const target = selected ?? root;
      if (selected !== null) setRoot(selected);
      requestFrame({
        fit: true,
        fallback: {
          person: target,
          align: next === "ancestors" ? "bottom" : "top",
        },
      });
    }
  }

  function startFrom(person: number) {
    setDemo(null);
    setLink(null);
    setView("descendants");
    setRoot(person);
    setToggled(new Set());
    requestFrame({ fit: true, fallback: { person, align: "top" } });
  }

  function toggle(person: number) {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(person)) next.delete(person);
      else next.add(person);
      return next;
    });
  }

  async function findMe() {
    setNotice(null);
    const response = await fetch("/api/moi", { cache: "no-store" });
    const me = response.ok
      ? ((await response.json()) as { personId: string | null })
      : null;
    const person = me?.personId ? model?.byId.get(me.personId) : undefined;
    if (person === undefined) {
      setNotice(t("me.notLinked"));
      return;
    }
    goTo(person, { sheet: true });
  }

  function openLink() {
    backTo.current = view === "path" ? backTo.current : view;
    setDemo(null);
    setLink({ a: selected, b: null });
  }

  function closePath() {
    setLink(null);
    setDemo(null);
    setView(backTo.current === "path" ? "descendants" : backTo.current);
    requestFrame({ person: selected ?? root, align: "center" });
  }

  function pickForLink(side: "a" | "b", person: number) {
    const next = { a: link?.a ?? null, b: link?.b ?? null, [side]: person };
    setLink(next);
    if (next.a !== null && next.b !== null) {
      setView("path");
      requestFrame({ fit: true });
    }
  }

  function startDemo(lineage: number) {
    if (!data) return;
    backTo.current = view === "path" ? backTo.current : view;
    setLink(null);
    setDemo({ lineage, steps: null, index: 0 });
    fetch(`/api/lignee/${data.lineages[lineage].id}`, { cache: "no-store" })
      .then((r) =>
        r.ok ? (r.json() as Promise<LineageStep[]>) : Promise.reject(r.status),
      )
      .then((steps) => {
        setDemo({ lineage, steps, index: 0 });
        setView("path");
        if (steps.length && model) {
          const first = model.byId.get(steps[0].parentId);
          if (first !== undefined)
            requestFrame({ person: first, align: desktop ? "center" : "top" });
        }
      })
      .catch(() => setDemo({ lineage, steps: null, index: 0, failed: true }));
  }

  function demoStep(index: number) {
    if (!demo?.steps || !model) return;
    setDemo({ ...demo, index });
    const step = demo.steps[index];
    const child = model.byId.get(step.childId);
    if (child !== undefined) {
      setSelected(child);
      requestFrame({ person: child, align: desktop ? "center" : "top" });
    }
  }

  function control(key: "zoomIn" | "zoomOut" | "fit") {
    if (key === "fit") canvas.current?.fit();
    else canvas.current?.zoomBy(key === "zoomIn" ? 1.4 : 1 / 1.4);
  }

  function onSelectRelative(relative: Relative) {
    const person = model?.byId.get(relative.id);
    if (person !== undefined) goTo(person, { sheet: true });
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="grid flex-1 place-content-center gap-4 px-(--gutter) py-24 text-center">
        <p className="text-lead">{t("error")}</p>
        <p>
          <button
            type="button"
            className="link font-medium"
            onClick={() => setAttempt((a) => a + 1)}
          >
            {t("retry")}
          </button>
        </p>
      </div>
    );
  }

  if (status === "ready" && data && !data.people.length) return <>{empty}</>;

  const sheetPerson = sheet ? data?.people[sheet.person] : null;
  const docked = desktop && view !== "list";
  const rightInset = sheet && docked ? PANEL_WIDTH : 0;
  const nowYear = new Date().getFullYear();

  return (
    <div
      ref={shell}
      className="tree-app flex h-[calc(100svh-var(--header-h))] min-h-[34rem] flex-col"
      style={
        offset !== null ? { height: `calc(100svh - ${offset}px)` } : undefined
      }
    >
      <div className="z-20 grid gap-3 border-b border-hairline bg-paper px-(--gutter) pt-4 pb-3 md:grid-cols-[auto_minmax(0,24rem)_1fr] md:items-center md:gap-x-6">
        <h1 className="sr-only font-display text-title-sm md:not-sr-only md:col-start-1 md:row-start-1">
          {t("title")}
        </h1>
        {data && model ? (
          <PersonSearch
            data={data}
            model={model}
            locale={locale}
            label={t("search.label")}
            onPick={(person) => goTo(person, { sheet: true })}
            className="md:col-start-2 md:row-start-1"
          />
        ) : (
          <div
            className="h-12 rounded-full border border-hairline bg-paper-2 md:col-start-2 md:row-start-1"
            aria-hidden="true"
          />
        )}
        {/* One scrolling row on phones; two rows on larger screens. */}
        <div
          className="-mx-(--gutter) flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-(--gutter) md:contents"
          aria-label={t("tools")}
          role="toolbar"
        >
          <div className="flex shrink-0 items-center gap-2 md:col-span-3 md:row-start-2 md:flex-wrap">
            {data?.entryPoints.map((e) => (
              <FilterChip
                key={e.person}
                pressed={view === "descendants" && root === e.person}
                onClick={() => startFrom(e.person)}
                className="shrink-0"
              >
                {e.label}
              </FilterChip>
            ))}
            <div
              role="group"
              aria-label={t("views.label")}
              className="flex shrink-0 rounded-full border border-hairline-strong p-0.5"
            >
              {(["descendants", "ancestors", "branches", "list"] as const).map(
                (v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => switchView(v)}
                    disabled={
                      !data || (v === "branches" && !data.branches.length)
                    }
                    className={cn(
                      "min-h-10 rounded-full px-3.5 text-caption font-medium transition-[background-color,color] duration-(--duration-fast)",
                      view === v
                        ? "bg-ink text-paper"
                        : "text-ink hover:bg-paper-2 disabled:text-ink-muted disabled:hover:bg-transparent",
                    )}
                  >
                    {t(`views.${v}`)}
                  </button>
                ),
              )}
            </div>
            {(view === "descendants" || view === "ancestors") && (
              <label className="flex shrink-0 items-center gap-2 text-caption text-ink-muted">
                <span>{t("depth.label")}</span>
                <select
                  value={depth}
                  onChange={(event) => {
                    setDepth(Number(event.target.value));
                    setToggled(new Set());
                  }}
                  className="tabular min-h-10 rounded-full border border-hairline-strong bg-paper px-3 text-ink"
                >
                  {DEPTHS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <FilterChip
              pressed={filtering}
              onClick={() => setFiltersOpen(true)}
              disabled={!data}
              className="shrink-0"
            >
              {t("filters.button")}
              {filtering && (
                <span className="tabular">· {activeFilterCount(filters)}</span>
              )}
            </FilterChip>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:col-start-3 md:row-start-1 md:justify-self-end">
            <FilterChip
              pressed={link !== null}
              onClick={() => (link ? closePath() : openLink())}
              disabled={!data}
              className="shrink-0"
            >
              {t("link.button")}
            </FilterChip>
            {signedIn && (
              <FilterChip pressed={false} onClick={findMe} className="shrink-0">
                {t("me.button")}
              </FilterChip>
            )}
            {data?.lineages.map((l, i) => (
              <FilterChip
                key={l.id}
                pressed={demo?.lineage === i}
                onClick={() => (demo ? closePath() : startDemo(i))}
                className="shrink-0"
              >
                {data.lineages.length > 1 ? l.title : t("demo.button")}
              </FilterChip>
            ))}
          </div>
        </div>
        <p
          role="status"
          className={cn(
            "text-caption text-croy-text md:col-span-3",
            !notice && "sr-only",
          )}
        >
          {notice}
        </p>
      </div>

      {link && data && model && (
        <section
          aria-label={t("link.title")}
          className="z-10 grid gap-3 border-b border-hairline bg-paper-2 px-(--gutter) py-4 md:grid-cols-[1fr_1fr_auto] md:items-start"
        >
          <PersonSearch
            data={data}
            model={model}
            locale={locale}
            size="small"
            label={t("link.first")}
            placeholder={t("link.first")}
            value={link.a}
            onPick={(p) => pickForLink("a", p)}
          />
          <PersonSearch
            data={data}
            model={model}
            locale={locale}
            size="small"
            label={t("link.second")}
            placeholder={t("link.second")}
            value={link.b}
            onPick={(p) => pickForLink("b", p)}
            autoFocus={link.a !== null}
          />
          <button
            type="button"
            onClick={closePath}
            className="link justify-self-start text-caption font-medium md:self-center"
          >
            {t("link.close")}
          </button>
          <p aria-live="polite" className="text-lead md:col-span-3">
            {link.a !== null && link.b !== null && relationship ? (
              relationship.kind === "none" ? (
                t("link.none")
              ) : relationship.kind === "self" ? (
                t("link.self")
              ) : (
                <>
                  <strong className="font-display font-medium">
                    {personLabel(data.people[link.b])}
                  </strong>
                  {t("link.is")}
                  <strong className="font-display font-medium text-croy-text">
                    {relationshipLabel(
                      relationship,
                      data.people[link.b].sex ?? "unknown",
                      locale,
                    )}
                  </strong>
                  {t("link.of")}
                  <strong className="font-display font-medium">
                    {personLabel(data.people[link.a])}
                  </strong>
                </>
              )
            ) : (
              <span className="text-body text-ink-muted">
                {t("link.intro")}
              </span>
            )}
          </p>
        </section>
      )}

      <div className="tree-stage relative min-h-0 flex-1 overflow-hidden bg-paper">
        {status === "loading" || !data || !model || !scene ? (
          <div
            className="grid h-full place-content-center gap-3 text-center text-ink-muted"
            role="status"
          >
            <span className="tree-loading mx-auto" aria-hidden="true" />
            {t("loading")}
          </div>
        ) : view === "list" ? (
          <PersonList
            data={data}
            locale={locale}
            isLit={isLit}
            filtering={filtering || year !== null}
            onOpen={(p) => goTo(p, { sheet: true })}
          />
        ) : (
          <>
            <TreeCanvas
              ref={canvas}
              data={data}
              graph={model.graph}
              scene={scene}
              locale={locale}
              selected={selected}
              path={pathSet}
              isLit={isLit}
              extinctEnds={ends}
              branchCounts={branchCounts}
              rightInset={rightInset}
              leftInset={demo && docked ? 448 : 0}
              onOpen={openSheet}
              onToggle={toggle}
              onRootUp={() => {
                const parent = model.graph.parents[root][0];
                if (parent !== undefined) {
                  setRoot(parent);
                  setToggled(new Set());
                  requestFrame({ person: parent, align: "top" });
                }
              }}
              onOpenBranch={(b) => {
                const founder = data.branches[b].founder;
                if (founder >= 0) startFrom(founder);
                else setFilters({ ...NO_FILTERS, branch: b });
              }}
            />
            {year !== null && (
              <p
                aria-hidden="true"
                className="tabular pointer-events-none absolute top-3 left-(--gutter) font-display text-title-lg leading-none text-croy-text"
              >
                {year}
              </p>
            )}
            <p
              id="tree-keys"
              className="tree-keys pointer-events-none absolute top-3 right-(--gutter) max-w-[22rem] rounded-sm bg-chrome px-3 py-2 text-right text-caption text-ink-muted backdrop-blur-md"
            >
              {t("canvas.keys")}
            </p>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 p-3 md:p-4"
              style={{ paddingRight: rightInset ? rightInset + 16 : undefined }}
            >
              <details className="tree-legend pointer-events-auto relative">
                <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-hairline-strong bg-chrome text-caption font-semibold backdrop-blur-md [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true">?</span>
                  <span className="sr-only">{t("legend.title")}</span>
                </summary>
                <div className="absolute bottom-full left-0 mb-2 grid w-[17rem] gap-2.5 rounded-sm border border-hairline bg-paper p-4 text-caption shadow-(--shadow-panel)">
                  <p className="font-medium">{t("legend.title")}</p>
                  {(
                    [
                      ["attested", undefined],
                      ["tradition", "7 5"],
                      ["debated", "1 5"],
                    ] as const
                  ).map(([key, dashArray]) => (
                    <p key={key} className="flex items-center gap-3">
                      <svg
                        aria-hidden="true"
                        width="36"
                        height="8"
                        className="shrink-0"
                      >
                        <line
                          x1="2"
                          x2="34"
                          y1="4"
                          y2="4"
                          stroke="var(--croy)"
                          strokeWidth="1.6"
                          strokeDasharray={dashArray}
                          strokeLinecap="round"
                        />
                      </svg>
                      {t(`certainty.${key}`)}
                    </p>
                  ))}
                  <p className="flex items-center gap-3">
                    <svg
                      aria-hidden="true"
                      width="36"
                      height="16"
                      className="shrink-0"
                    >
                      <line
                        x1="18"
                        x2="18"
                        y1="0"
                        y2="10"
                        stroke="var(--branch-extinct)"
                        strokeWidth="1.4"
                      />
                      <line
                        x1="10"
                        x2="26"
                        y1="10"
                        y2="10"
                        stroke="var(--branch-extinct)"
                        strokeWidth="1.4"
                      />
                    </svg>
                    {t("legend.extinct")}
                  </p>
                  <p className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-4 w-9 shrink-0 rounded-[3px] border border-dashed border-hairline-strong bg-paper-2"
                    />
                    {t("living")}
                  </p>
                  <p className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid w-9 shrink-0 place-items-center"
                    >
                      <span className="size-1.5 rounded-full bg-croy" />
                    </span>
                    {t("legend.photo")}
                  </p>
                </div>
              </details>

              <div
                className={cn(
                  "pointer-events-auto flex h-11 min-w-0 items-center gap-2 rounded-full border border-hairline-strong bg-chrome backdrop-blur-md",
                  year !== null ? "flex-1 pr-2 pl-1 md:max-w-[32rem]" : "",
                )}
              >
                <button
                  type="button"
                  aria-pressed={year !== null}
                  onClick={() =>
                    setYear(
                      year === null
                        ? Math.min(nowYear, Math.max(model.minYear, 1500))
                        : null,
                    )
                  }
                  className="grid size-11 shrink-0 place-items-center rounded-full"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="size-5"
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M10 6v4l2.5 2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="sr-only">{t("time.label")}</span>
                </button>
                {year !== null && (
                  <>
                    <input
                      type="range"
                      min={model.minYear}
                      max={nowYear}
                      step={1}
                      value={year}
                      onChange={(event) => setYear(Number(event.target.value))}
                      aria-label={t("time.year")}
                      aria-valuetext={t("time.value", { year })}
                      className="tree-range min-w-0 flex-1"
                    />
                    <output className="tabular w-12 shrink-0 text-right text-caption font-medium">
                      {year}
                    </output>
                  </>
                )}
              </div>

              <div className="pointer-events-auto ml-auto grid gap-2">
                {(
                  [
                    ["zoomIn", "M10 5v10M5 10h10"],
                    ["zoomOut", "M5 10h10"],
                    ["fit", "M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"],
                  ] as const
                ).map(([key, d]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => control(key)}
                    className="grid size-11 place-items-center rounded-full border border-hairline-strong bg-chrome backdrop-blur-md transition-transform duration-(--duration-press) active:scale-[0.94]"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="size-5"
                    >
                      <path
                        d={d}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="sr-only">{t(`controls.${key}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {demo && (
              <LineageCard
                data={data}
                model={model}
                lineage={data.lineages[demo.lineage]}
                steps={demo.steps}
                failed={demo.failed}
                index={demo.index}
                onStep={demoStep}
                onClose={closePath}
                rightInset={rightInset}
                locale={locale}
              />
            )}
          </>
        )}
      </div>

      {data && model && (
        <FiltersPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          data={data}
          locale={locale}
          filters={filters}
          onChange={setFilters}
          matching={
            data.people.filter((p) => !p.hidden && matchesFilters(p, filters))
              .length
          }
        />
      )}

      <SidePanel
        open={sheet !== null}
        modal={!docked}
        onClose={() => setSheet(null)}
        eyebrow={
          sheetPerson && !sheetPerson.hidden && sheetPerson.branch >= 0
            ? data?.branches[sheetPerson.branch]?.name
            : undefined
        }
        title={
          sheetPerson
            ? sheetPerson.hidden
              ? t("living")
              : personLabel(sheetPerson)
            : ""
        }
        footer={
          sheetPerson?.slug && !sheetPerson.hidden ? (
            <Link
              href={{
                pathname: "/arbre/[personne]",
                params: { personne: sheetPerson.slug },
              }}
              className="link text-caption font-medium"
            >
              {t("sheet.fullPage")}
            </Link>
          ) : undefined
        }
      >
        {sheet && sheetPerson?.hidden ? (
          <p className="text-ink-muted">{t("sheet.livingHidden")}</p>
        ) : sheet?.detail ? (
          <PersonSheet
            person={sheet.detail}
            onSelect={onSelectRelative}
            headingLevel="h2"
            showName={false}
            signedIn={signedIn}
          />
        ) : sheet?.failed ? (
          <p className="text-ink-muted">{t("sheet.error")}</p>
        ) : (
          <div className="grid gap-3" role="status" aria-label={t("loading")}>
            <span className="h-4 w-2/3 animate-pulse rounded-xs bg-paper-2" />
            <span className="h-4 w-1/2 animate-pulse rounded-xs bg-paper-2" />
            <span className="h-24 animate-pulse rounded-xs bg-paper-2" />
          </div>
        )}
      </SidePanel>
    </div>
  );
}
