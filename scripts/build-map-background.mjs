// Builds public/carte/fond.json and fond-detail.json, the background of the
// map of the Places and events page: land and borders of Europe and its
// neighbours, from Natural Earth (public domain) via the world-atlas package.
// The 1:50m file is drawn first, the 1:10m one only once the map is zoomed
// in. No tile server, no key: the map is drawn in the colours of the site.
// Run again only to change the area covered:
//   node scripts/build-map-background.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature, mesh } from "topojson-client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlas = (name) =>
  readFile(path.join(root, "node_modules", "world-atlas", name), "utf8").then(
    JSON.parse,
  );

// From the Azores to the Urals, from the Sahara to the North Cape.
const [W, S, E, N] = [-32, 26, 52, 72];
const round = (n) => Math.round(n * 1000) / 1000;

/**
 * Eurasia crosses the antimeridian: its longitudes are made continuous
 * (Chukotka beyond 180°) so that clipping does not draw a seam across Europe.
 */
function unwrap(ring) {
  const out = [];
  for (const [lng, lat] of ring) {
    let x = lng;
    const previous = out[out.length - 1];
    if (previous) while (x - previous[0] > 180) x -= 360;
    if (previous) while (x - previous[0] < -180) x += 360;
    out.push([x, lat]);
  }
  // Back to the turn of the globe where most of the ring lies.
  const mean = out.reduce((sum, p) => sum + p[0], 0) / out.length;
  const turn = Math.round(mean / 360) * 360;
  return turn ? out.map(([x, y]) => [x - turn, y]) : out;
}

/** Sutherland–Hodgman: a ring clipped to the rectangle. */
function clipRing(ring) {
  const edges = [
    [(p) => p[0] >= W, (a, b) => at(a, b, 0, W)],
    [(p) => p[0] <= E, (a, b) => at(a, b, 0, E)],
    [(p) => p[1] >= S, (a, b) => at(a, b, 1, S)],
    [(p) => p[1] <= N, (a, b) => at(a, b, 1, N)],
  ];
  let points = ring;
  for (const [inside, cross] of edges) {
    if (!points.length) break;
    const input = points;
    points = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) points.push(cross(previous, current));
        points.push(current);
      } else if (inside(previous)) points.push(cross(previous, current));
    }
  }
  return points;
}

function at(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return axis === 0
    ? [value, a[1] + t * (b[1] - a[1])]
    : [a[0] + t * (b[0] - a[0]), value];
}

const inBox = (p) => p[0] >= W && p[0] <= E && p[1] >= S && p[1] <= N;

/** Lines cut where they leave the rectangle. */
function clipLine(line) {
  const out = [];
  let current = [];
  for (const p of line) {
    if (inBox(p)) current.push(p);
    else if (current.length) {
      out.push(current);
      current = [];
    }
  }
  if (current.length) out.push(current);
  return out.filter((l) => l.length > 1);
}

/** Rounded, without the points that rounding made identical. */
function tidy(points) {
  const out = [];
  for (const p of points) {
    const q = [round(p[0]), round(p[1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}

async function build(scale, file) {
  const land = await atlas(`land-${scale}.json`);
  const countries = await atlas(`countries-${scale}.json`);

  const polygons = [];
  for (const f of feature(land, land.objects.land).features) {
    const geometry = f.geometry;
    const list =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const polygon of list) {
      const rings = polygon
        .map((ring) => tidy(clipRing(unwrap(ring))))
        .filter((ring) => ring.length > 3);
      if (rings.length && rings[0].length > 3) {
        for (const ring of rings) ring.push(ring[0]);
        polygons.push(rings);
      }
    }
  }

  const borders = mesh(
    countries,
    countries.objects.countries,
    (a, b) => a !== b,
  )
    .coordinates.flatMap(clipLine)
    .map(tidy)
    .filter((l) => l.length > 1);

  const background = {
    type: "FeatureCollection",
    source: `Natural Earth 1:${scale}, public domain, via world-atlas`,
    bbox: [W, S, E, N],
    features: [
      {
        type: "Feature",
        properties: { layer: "land" },
        geometry: { type: "MultiPolygon", coordinates: polygons },
      },
      {
        type: "Feature",
        properties: { layer: "borders" },
        geometry: { type: "MultiLineString", coordinates: borders },
      },
    ],
  };

  const out = path.join(root, "public", "carte", file);
  await writeFile(out, JSON.stringify(background));
  console.log(
    `${path.relative(root, out)}: ${polygons.length} polygons, ${borders.length} borders`,
  );
}

await build("50m", "fond.json");
await build("10m", "fond-detail.json");
