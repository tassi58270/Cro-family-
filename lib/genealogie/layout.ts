import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";

/**
 * Positions of the family tree (cahier des charges, 6.2), computed apart
 * from the drawing so they can be tested: descendants of a person (with
 * their partners side by side), ancestors of a person, the branches, and
 * the path between two people. Coordinates are in pixels; y grows downward.
 */

export const CARD_W = 184;
export const CARD_H = 64;
export const PARTNER_GAP = 14;
export const SIBLING_GAP = 28;
export const LEVEL_H = 132;

export type GraphInput = {
  count: number;
  /** [parent, child, union or -1, certainty] */
  links: [number, number, number, number][];
  /** [partner, partner or -1, order, year, certainty] */
  unions: [number, number, number, number | null, number][];
  birthOf: (i: number) => number | null;
};

export type Graph = {
  parents: number[][];
  children: number[][];
  /** For each person, their unions: [union index, partner or -1], in order. */
  unions: [number, number][][];
  /** Certainty of the link parent → child, keyed `${parent}>${child}`. */
  certainty: Map<string, number>;
  /** The union a child was born of, keyed `${parent}>${child}`. */
  unionOf: Map<string, number>;
};

export function buildGraph(input: GraphInput): Graph {
  const parents: number[][] = Array.from({ length: input.count }, () => []);
  const children: number[][] = Array.from({ length: input.count }, () => []);
  const unions: [number, number][][] = Array.from(
    { length: input.count },
    () => [],
  );
  const certainty = new Map<string, number>();
  const unionOf = new Map<string, number>();
  for (const [p, c, u, cert] of input.links) {
    parents[c].push(p);
    children[p].push(c);
    certainty.set(`${p}>${c}`, cert);
    if (u >= 0) unionOf.set(`${p}>${c}`, u);
  }
  input.unions
    .map((u, i) => ({ u, i }))
    .sort((a, b) => a.u[2] - b.u[2])
    .forEach(({ u: [a, b], i }) => {
      unions[a].push([i, b]);
      if (b >= 0) unions[b].push([i, a]);
    });
  const byBirth = (x: number, y: number) =>
    (input.birthOf(x) ?? 99999) - (input.birthOf(y) ?? 99999) || x - y;
  for (const list of children) list.sort(byBirth);
  return { parents, children, unions, certainty, unionOf };
}

export type LayoutNode = {
  person: number;
  partners: number[];
  /** Centre of the block (person and partners). */
  x: number;
  y: number;
  width: number;
  depth: number;
  open: boolean;
  /** Has children (descendants) or parents (ancestors) not drawn yet. */
  more: boolean;
  /** Already drawn elsewhere in this view (a marriage between cousins). */
  repeat: boolean;
};

export type LayoutEdge = {
  from: number;
  to: number;
  /** Path for SVG, from the parents to the child. */
  d: string;
  certainty: number;
};

export type Layout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** Centre of each person's card, to fly to them. */
  positions: Map<number, { x: number; y: number }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

type Block = {
  person: number;
  partners: number[];
  depth: number;
  open: boolean;
  more: boolean;
  repeat: boolean;
  children: Block[];
};

function blockWidth(b: { partners: number[] }) {
  return CARD_W * (1 + b.partners.length) + PARTNER_GAP * b.partners.length;
}

/** Left edge of card `k` (0 is the person, then partners) in a block centred on x. */
function cardLeft(x: number, b: { partners: number[] }, k: number) {
  return x - blockWidth(b) / 2 + k * (CARD_W + PARTNER_GAP);
}

function finish(
  root: HierarchyPointNode<Block>,
  edgesFor: (node: HierarchyPointNode<Block>) => LayoutEdge[],
): Layout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const positions = new Map<number, { x: number; y: number }>();
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  root.each((n) => {
    const b = n.data;
    const width = blockWidth(b);
    nodes.push({
      person: b.person,
      partners: b.partners,
      x: n.x,
      y: n.y,
      width,
      depth: b.depth,
      open: b.open,
      more: b.more,
      repeat: b.repeat,
    });
    if (!b.repeat || !positions.has(b.person)) {
      positions.set(b.person, { x: cardLeft(n.x, b, 0) + CARD_W / 2, y: n.y });
    }
    b.partners.forEach((p, k) => {
      if (!positions.has(p)) {
        positions.set(p, { x: cardLeft(n.x, b, k + 1) + CARD_W / 2, y: n.y });
      }
    });
    bounds.minX = Math.min(bounds.minX, n.x - width / 2);
    bounds.maxX = Math.max(bounds.maxX, n.x + width / 2);
    bounds.minY = Math.min(bounds.minY, n.y - CARD_H / 2);
    bounds.maxY = Math.max(bounds.maxY, n.y + CARD_H / 2);
    edges.push(...edgesFor(n));
  });
  if (!nodes.length) bounds.minX = bounds.maxX = bounds.minY = bounds.maxY = 0;
  return { nodes, edges, positions, bounds };
}

const elbow = (x1: number, y1: number, x2: number, y2: number) => {
  const mid = (y1 + y2) / 2;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}V${mid.toFixed(1)}H${x2.toFixed(1)}V${y2.toFixed(1)}`;
};

/**
 * Descendants of `root`. Generations closer than `openDepth` are open;
 * `toggled` flips that for single people.
 */
export function layoutDescendants(
  graph: Graph,
  root: number,
  openDepth: number,
  toggled: ReadonlySet<number>,
): Layout {
  const placed = new Set<number>();
  const build = (person: number, depth: number): Block => {
    const repeat = placed.has(person);
    placed.add(person);
    const partners = graph.unions[person]
      .map(([, p]) => p)
      .filter((p) => p >= 0);
    const kids = graph.children[person];
    const open =
      !repeat && kids.length > 0 && depth < openDepth !== toggled.has(person);
    return {
      person,
      partners: repeat ? [] : partners,
      depth,
      open,
      more: !repeat && kids.length > 0 && !open,
      repeat,
      children: open ? kids.map((c) => build(c, depth + 1)) : [],
    };
  };
  const data = build(root, 0);
  const h = hierarchy(data, (b) => (b.open ? b.children : null));
  const laid = tree<Block>()
    .nodeSize([1, LEVEL_H])
    .separation(
      (a, b) => (blockWidth(a.data) + blockWidth(b.data)) / 2 + SIBLING_GAP,
    )(h);

  return finish(laid, (n) => {
    if (!n.children) return [];
    const b = n.data;
    return n.children.map((c) => {
      // From between the two parents when the child is of a union with a partner.
      const union = graph.unionOf.get(`${b.person}>${c.data.person}`);
      const partnerIndex =
        union === undefined
          ? -1
          : b.partners.findIndex((p) =>
              graph.unions[b.person].some(([u, q]) => u === union && q === p),
            );
      const personX = cardLeft(n.x, b, 0) + CARD_W / 2;
      const startX =
        partnerIndex < 0
          ? personX
          : (personX + cardLeft(n.x, b, partnerIndex + 1) + CARD_W / 2) / 2;
      const childX = cardLeft(c.x, c.data, 0) + CARD_W / 2;
      return {
        from: b.person,
        to: c.data.person,
        d: elbow(startX, n.y + CARD_H / 2, childX, c.y - CARD_H / 2),
        certainty: graph.certainty.get(`${b.person}>${c.data.person}`) ?? 0,
      };
    });
  });
}

/** Ancestors of `root`, growing upward. */
export function layoutAncestors(
  graph: Graph,
  root: number,
  openDepth: number,
  toggled: ReadonlySet<number>,
): Layout {
  const placed = new Set<number>();
  const build = (person: number, depth: number): Block => {
    const repeat = placed.has(person);
    placed.add(person);
    const ps = graph.parents[person];
    const open =
      !repeat && ps.length > 0 && depth < openDepth !== toggled.has(person);
    return {
      person,
      partners: [],
      depth,
      open,
      more: !repeat && ps.length > 0 && !open,
      repeat,
      children: open ? ps.map((p) => build(p, depth + 1)) : [],
    };
  };
  const h = hierarchy(build(root, 0), (b) => (b.open ? b.children : null));
  const laid = tree<Block>()
    .nodeSize([1, LEVEL_H])
    .separation(() => CARD_W + SIBLING_GAP)(h);
  laid.each((n) => {
    n.y = -n.y;
  });
  return finish(laid, (n) =>
    (n.children ?? []).map((parent) => ({
      from: parent.data.person,
      to: n.data.person,
      d: elbow(parent.x, parent.y + CARD_H / 2, n.x, n.y - CARD_H / 2),
      certainty:
        graph.certainty.get(`${parent.data.person}>${n.data.person}`) ?? 0,
    })),
  );
}

/**
 * The path between two people, as returned by findRelationship: going up a
 * generation raises the card, going down lowers it, a marriage stays level.
 */
export function layoutPath(path: number[], graph: Graph): Layout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const positions = new Map<number, { x: number; y: number }>();
  let level = 0;
  path.forEach((person, i) => {
    if (i > 0) {
      const prev = path[i - 1];
      if (graph.parents[prev].includes(person)) level -= 1;
      else if (graph.children[prev].includes(person)) level += 1;
    }
    const x = i * (CARD_W + SIBLING_GAP * 2);
    const y = level * LEVEL_H;
    nodes.push({
      person,
      partners: [],
      x,
      y,
      width: CARD_W,
      depth: i,
      open: false,
      more: false,
      repeat: false,
    });
    positions.set(person, { x, y });
    if (i > 0) {
      const a = positions.get(path[i - 1])!;
      const fromParent = a.y < y;
      const sameLevel = a.y === y;
      edges.push({
        from: path[i - 1],
        to: person,
        d: sameLevel
          ? `M${a.x + CARD_W / 2} ${y}H${x - CARD_W / 2}`
          : fromParent
            ? elbow(a.x, a.y + CARD_H / 2, x, y - CARD_H / 2)
            : elbow(x, y + CARD_H / 2, a.x, a.y - CARD_H / 2),
        certainty: 0,
      });
    }
  });
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  return {
    nodes,
    edges,
    positions,
    bounds: {
      minX: Math.min(...xs, 0) - CARD_W / 2,
      maxX: Math.max(...xs, 0) + CARD_W / 2,
      minY: Math.min(...ys, 0) - CARD_H / 2,
      maxY: Math.max(...ys, 0) + CARD_H / 2,
    },
  };
}

export type BranchNode = { branch: number; x: number; y: number };

/** The branches as a tree of their own, from the oldest to the youngest. */
export function layoutBranches(parents: number[]): {
  nodes: BranchNode[];
  edges: { from: number; to: number; d: string }[];
  bounds: Layout["bounds"];
} {
  type B = { branch: number; children: B[] };
  const nodesFor = (parent: number): B[] =>
    parents
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p === parent)
      .map(({ i }) => ({ branch: i, children: nodesFor(i) }));
  const roots = nodesFor(-1);
  const virtual: B = { branch: -1, children: roots };
  const laid = tree<B>().nodeSize([CARD_W + SIBLING_GAP * 2, LEVEL_H])(
    hierarchy(virtual),
  );
  const nodes: BranchNode[] = [];
  const edges: { from: number; to: number; d: string }[] = [];
  laid.each((n) => {
    if (n.data.branch < 0) return;
    nodes.push({ branch: n.data.branch, x: n.x, y: n.y - LEVEL_H });
    if (n.parent && n.parent.data.branch >= 0) {
      edges.push({
        from: n.parent.data.branch,
        to: n.data.branch,
        d: elbow(
          n.parent.x,
          n.parent.y - LEVEL_H + CARD_H / 2,
          n.x,
          n.y - LEVEL_H - CARD_H / 2,
        ),
      });
    }
  });
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  return {
    nodes,
    edges,
    bounds: {
      minX: Math.min(...xs, 0) - CARD_W / 2,
      maxX: Math.max(...xs, 0) + CARD_W / 2,
      minY: Math.min(...ys, 0) - CARD_H / 2,
      maxY: Math.max(...ys, 0) + CARD_H / 2,
    },
  };
}
