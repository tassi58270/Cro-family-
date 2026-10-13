import "server-only";
import sharp from "sharp";

/**
 * Pictures for the fictional « Exemple » family: drawn silhouettes and
 * landscapes in old-photo tones, made on the fly. Nobody real is on them.
 */

type Figure = { x: number; scale?: number };

const W = 1200;

function sky(h: number, top: string, bottom: string) {
  return `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
  <radialGradient id="v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient></defs>
  <rect width="${W}" height="${h}" fill="url(#s)"/>`;
}

const vignette = (h: number) =>
  `<rect width="${W}" height="${h}" fill="url(#v)"/>`;

/** A head and shoulders, centred on x, standing on the bottom of the picture. */
function person(x: number, h: number, scale = 1, tone = "#3b3128") {
  const head = 62 * scale;
  const cy = h - 330 * scale;
  return `<g fill="${tone}">
    <circle cx="${x}" cy="${cy}" r="${head}"/>
    <path d="M${x - 150 * scale} ${h} C${x - 150 * scale} ${cy + 140 * scale} ${x - 90 * scale} ${cy + 80 * scale} ${x} ${cy + 80 * scale} C${x + 90 * scale} ${cy + 80 * scale} ${x + 150 * scale} ${cy + 140 * scale} ${x + 150 * scale} ${h} Z"/>
  </g>`;
}

/** Where a face is, as fractions of the picture, for media_people.box. */
export function faceBox(
  f: Figure,
  h: number,
): [number, number, number, number] {
  const scale = f.scale ?? 1;
  const r = 62 * scale;
  const cy = h - 330 * scale;
  return [
    round((f.x - r * 1.25) / W),
    round((cy - r * 1.3) / h),
    round((r * 2.5) / W),
    round((r * 2.6) / h),
  ];
}

const round = (n: number) => Math.round(n * 10000) / 10000;

export type DemoPicture = {
  key: string;
  height: number;
  figures: Figure[];
  svg: string;
};

function group(
  key: string,
  h: number,
  figures: Figure[],
  top: string,
  bottom: string,
  tones: string[],
): DemoPicture {
  const people = figures
    .map((f, i) => person(f.x, h, f.scale ?? 1, tones[i % tones.length]))
    .join("");
  return {
    key,
    height: h,
    figures,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}">${sky(h, top, bottom)}${people}${vignette(h)}</svg>`,
  };
}

export const demoPictures: DemoPicture[] = [
  group(
    "portrait-albert",
    1500,
    [{ x: 600, scale: 2.1 }],
    "#d9c7a7",
    "#a68c69",
    ["#2e261f"],
  ),
  group(
    "mariage",
    900,
    [
      { x: 470, scale: 1.25 },
      { x: 740, scale: 1.15 },
    ],
    "#cdbb9c",
    "#8f7656",
    ["#2f2720", "#e9e0cf"],
  ),
  group(
    "groupe",
    800,
    [
      { x: 330, scale: 0.95 },
      { x: 600, scale: 1 },
      { x: 870, scale: 0.9 },
    ],
    "#c9c2b3",
    "#7d776c",
    ["#2b2a28", "#3a3733", "#24221f"],
  ),
  group(
    "reunion",
    800,
    [
      { x: 230, scale: 0.8 },
      { x: 480, scale: 0.85 },
      { x: 720, scale: 0.8 },
      { x: 970, scale: 0.75 },
    ],
    "#b9cbd6",
    "#6f8a72",
    ["#3d3a36", "#5a4636", "#2f3a46", "#4b3b2e"],
  ),
  {
    key: "verger",
    height: 800,
    figures: [],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="800">${sky(800, "#e3d6bd", "#b7a27f")}
      <path d="M0 560 C300 470 520 600 800 520 C980 470 1100 520 1200 500 V800 H0Z" fill="#7d6d52"/>
      <path d="M0 640 C260 600 640 690 1200 610 V800 H0Z" fill="#5f533f"/>
      ${[150, 330, 520, 720, 930, 1080]
        .map(
          (x, i) =>
            `<rect x="${x - 6}" y="${520 - (i % 2) * 20}" width="12" height="90" fill="#3e3529"/><circle cx="${x}" cy="${500 - (i % 2) * 20}" r="${58 + (i % 3) * 8}" fill="#4d4434"/>`,
        )
        .join("")}${vignette(800)}</svg>`,
  },
  {
    key: "chateau",
    height: 850,
    figures: [],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="850">${sky(850, "#d8d2c4", "#a49c8b")}
      <g fill="#4a443b"><rect x="330" y="360" width="540" height="330"/><rect x="270" y="250" width="110" height="440"/><rect x="820" y="250" width="110" height="440"/>
      <path d="M260 250 L325 150 L390 250Z M810 250 L875 150 L940 250Z M330 360 L600 250 L870 360Z"/></g>
      <g fill="#c9c1ad">${[400, 500, 600, 700, 760]
        .map(
          (x) =>
            `<rect x="${x}" y="430" width="34" height="56"/><rect x="${x}" y="540" width="34" height="56"/>`,
        )
        .join("")}<rect x="565" y="600" width="70" height="90"/></g>
      <rect y="690" width="${W}" height="160" fill="#6b6455"/>${vignette(850)}</svg>`,
  },
];

export async function renderDemoPicture(picture: DemoPicture): Promise<Buffer> {
  return sharp(Buffer.from(picture.svg)).jpeg({ quality: 82 }).toBuffer();
}
