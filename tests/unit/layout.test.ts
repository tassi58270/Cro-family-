import { describe, expect, it } from "vitest";
import { syntheticFamily } from "@/lib/demo/synthetic";
import {
  buildGraph,
  CARD_W,
  layoutAncestors,
  layoutDescendants,
  layoutPath,
  type Layout,
} from "@/lib/genealogie/layout";

const family = syntheticFamily(2000);
const graph = buildGraph({
  count: family.people.length,
  links: family.links.map(([p, c, u]) => [p, c, u, 0]),
  unions: family.unions.map(([a, b, y]) => [a, b, 1, y, 0]),
  birthOf: (i) => family.people[i].birth,
});

function expectNoOverlap(layout: Layout) {
  const rows = new Map<number, [number, number][]>();
  for (const n of layout.nodes) {
    const row = rows.get(n.y) ?? [];
    row.push([n.x - n.width / 2, n.x + n.width / 2]);
    rows.set(n.y, row);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < row.length; i++) {
      expect(row[i][0]).toBeGreaterThanOrEqual(row[i - 1][1] - 0.5);
    }
  }
}

describe("the synthetic test family", () => {
  it("has 2 000 people", () => {
    expect(family.people).toHaveLength(2000);
  });
});

describe("layoutDescendants", () => {
  it("lays out 2 000 people without any overlap, quickly", () => {
    const start = performance.now();
    const layout = layoutDescendants(graph, 0, 99, new Set());
    const elapsed = performance.now() - start;
    // Every person is either a card of their own or a partner on a card.
    const shown = new Set(
      layout.nodes.flatMap((n) => [n.person, ...n.partners]),
    );
    expect(shown.size).toBe(2000);
    expectNoOverlap(layout);
    expect(elapsed).toBeLessThan(500);
  });

  it("opens the first generations and keeps the rest folded", () => {
    const layout = layoutDescendants(graph, 0, 2, new Set());
    expect(Math.max(...layout.nodes.map((n) => n.depth))).toBe(2);
    expect(layout.nodes.some((n) => n.more)).toBe(true);
  });

  it("unfolds one person on demand", () => {
    const folded = layoutDescendants(graph, 0, 1, new Set());
    const child = graph.children[0][0];
    const unfolded = layoutDescendants(graph, 0, 1, new Set([child]));
    expect(unfolded.nodes.length).toBeGreaterThan(folded.nodes.length);
  });

  it("draws one line per child, from between both parents", () => {
    const layout = layoutDescendants(graph, 0, 1, new Set());
    const root = layout.nodes[0];
    const parentsMid = root.x - root.width / 2 + CARD_W + 7;
    expect(layout.edges.length).toBe(graph.children[0].length);
    expect(layout.edges[0].d.startsWith(`M${parentsMid.toFixed(1)}`)).toBe(
      true,
    );
  });
});

describe("layoutAncestors", () => {
  it("places parents above", () => {
    const youngest = family.people.length - 1;
    const layout = layoutAncestors(graph, youngest, 3, new Set());
    const me = layout.positions.get(youngest)!;
    for (const parent of graph.parents[youngest]) {
      expect(layout.positions.get(parent)!.y).toBeLessThan(me.y);
    }
    expectNoOverlap(layout);
  });
});

describe("layoutPath", () => {
  it("raises the cards going up and lowers them going down", () => {
    const child = graph.children[0][0];
    const grandchild = graph.children[child][0];
    const layout = layoutPath([grandchild, child, 0], graph);
    const y = (p: number) => layout.positions.get(p)!.y;
    expect(y(child)).toBeLessThan(y(grandchild));
    expect(y(0)).toBeLessThan(y(child));
  });
});
