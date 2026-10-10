// Builds public/carte/europe.json, the pared-back map of Europe behind the
// chapters of the home page, from Natural Earth (public domain) via the
// world-atlas package. Run again only to change the framing:
//   node scripts/build-europe-map.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoConicConformal, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlas = (name) =>
  readFile(path.join(root, "node_modules", "world-atlas", name), "utf8").then(
    JSON.parse,
  );

// From the Atlantic to the Carpathians, from Andalusia to the Baltic: every
// place the family history may visit, Hungary included.
const WIDTH = 1000;
const HEIGHT = 860;
export const projectionSettings = {
  parallels: [38, 58],
  rotate: [-9, 0],
  center: [0, 48.5],
};

const projection = geoConicConformal()
  .parallels(projectionSettings.parallels)
  .rotate(projectionSettings.rotate)
  .center(projectionSettings.center)
  .fitExtent(
    [
      [0, 0],
      [WIDTH, HEIGHT],
    ],
    {
      type: "MultiPoint",
      coordinates: [
        [-10.5, 36],
        [27, 36],
        [-10.5, 59.5],
        [27, 59.5],
      ],
    },
  )
  .clipExtent([
    [-20, -20],
    [WIDTH + 20, HEIGHT + 20],
  ]);

const pathOf = geoPath(projection).digits(1);

const land = await atlas("land-50m.json");
const countries = await atlas("countries-50m.json");

const landPath = pathOf(feature(land, land.objects.land));
const borders = pathOf(
  mesh(countries, countries.objects.countries, (a, b) => a !== b),
);

const output = {
  source: "Natural Earth 1:50m, public domain, via world-atlas",
  width: WIDTH,
  height: HEIGHT,
  projection: {
    ...projectionSettings,
    scale: projection.scale(),
    translate: projection.translate(),
  },
  land: landPath,
  borders,
};

// The projection alone, for the server (small previews, place markers).
await mkdir(path.join(root, "lib", "carte"), { recursive: true });
await writeFile(
  path.join(root, "lib", "carte", "projection.json"),
  JSON.stringify(
    { width: WIDTH, height: HEIGHT, ...output.projection },
    null,
    2,
  ) + "\n",
);

await mkdir(path.join(root, "public", "carte"), { recursive: true });
const file = path.join(root, "public", "carte", "europe.json");
await writeFile(file, JSON.stringify(output));
console.log(`${file}: ${(JSON.stringify(output).length / 1024).toFixed(0)} kB`);
