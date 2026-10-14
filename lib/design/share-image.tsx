import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SHIELD_PATH } from "@/components/heraldique/shield";

/**
 * The image shown when a page is shared (section 3): direction A
 * « Monument », the arms above the name, white and Croÿ red only.
 * next/og draws with satori, which reads TTF, not the site's WOFF2.
 */
export const shareImageSize = { width: 1200, height: 630 };

const RED = "#C8102E";
const INK = "#141414";
const MUTED = "#5f5f5b";

const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/BodoniModa-Medium-96.ttf")),
  readFile(
    join(process.cwd(), "assets/fonts/AtkinsonHyperlegibleNext-Medium.ttf"),
  ),
]);

// The arms of Croÿ: argent, three fasces gules, clipped to the shield.
const shield = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 102 122">
<clipPath id="c"><path d="${SHIELD_PATH}"/></clipPath>
<path d="${SHIELD_PATH}" fill="#fff"/>
<g clip-path="url(#c)" fill="${RED}">${[1, 3, 5]
  .map(
    (i) => `<rect x="0" y="${(i * 120) / 7}" width="100" height="${120 / 7}"/>`,
  )
  .join("")}</g>
<path d="${SHIELD_PATH}" fill="none" stroke="${RED}" stroke-width="1.2"/>
</svg>`;
export const shieldSrc = `data:image/svg+xml;base64,${Buffer.from(shield).toString("base64")}`;

export async function shareImage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const [bodoni, atkinson] = await fonts;
  const fontSize = title.length <= 14 ? 168 : title.length <= 32 ? 84 : 64;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        color: INK,
        padding: "0 96px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shieldSrc} width={150} height={178} alt="" />
      <div
        style={{
          fontFamily: "Bodoni Moda",
          fontSize,
          lineHeight: 1.05,
          marginTop: 28,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontFamily: "Atkinson",
            fontSize: 36,
            color: MUTED,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 8, background: RED }} />
        ))}
      </div>
    </div>,
    {
      ...shareImageSize,
      fonts: [
        { name: "Bodoni Moda", data: bodoni, weight: 500, style: "normal" },
        { name: "Atkinson", data: atkinson, weight: 500, style: "normal" },
      ],
    },
  );
}
