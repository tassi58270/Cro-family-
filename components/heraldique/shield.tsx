import { useId, type ReactNode } from "react";

/**
 * Coats of arms drawn for the project, in SVG (cahier des charges, step 2).
 * The family can replace any of them with its own file later (arms table).
 *
 * All shields share one outline on a 100 × 120 grid: a flat chief, straight
 * flanks down to 4/7 of the height, then a rounded point.
 */
export const SHIELD_PATH =
  "M0 0 L100 0 L100 68.571 C100 98 78 112 50 120 C22 112 0 98 0 68.571 Z";

/** Built-in arms. Blazons are in `messages/*.json` under `arms`. */
export const builtInArms = ["croy", "croy-renty", "hongrie-ancienne"] as const;
export type BuiltInArms = (typeof builtInArms)[number];

/** Three fasces: the field cut in seven equal bands, the 2nd, 4th and 6th red. */
function Fasces({
  x = 0,
  y = 0,
  width = 100,
  height = 120,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const unit = height / 7;
  return (
    <g data-part="fasces">
      {[1, 3, 5].map((i) => (
        <rect key={i} x={x} y={y + i * unit} width={width} height={unit} />
      ))}
    </g>
  );
}

/**
 * A doloire: a broad axe head with a curved cutting edge to the left and a
 * short socket to the right. Drawn in a 24 × 20 box, both parts wound the
 * same way so that they merge.
 */
const DOLOIRE =
  "M14 6.2 C10.5 5.4 6.6 3.6 3.6 0.8 C0 6 0 14 3.6 19.2 C6.6 16.4 10.5 14.6 14 13.8 Z M12.5 7.6 V12.4 H21.6 Q23.4 10 21.6 7.6 Z";
const DOLOIRE_SCALE = 20 / 24;

function Doloire({
  x,
  y,
  flip = false,
}: {
  x: number;
  y: number;
  flip?: boolean;
}) {
  const s = DOLOIRE_SCALE;
  const transform = flip
    ? `translate(${x + 20} ${y}) scale(${-s} ${s})`
    : `translate(${x} ${y}) scale(${s})`;
  return <path d={DOLOIRE} transform={transform} />;
}

/** Renty: three doloires, the two in chief addorsed (backs to each other). */
function Renty({ x, y }: { x: number; y: number }) {
  return (
    <g data-part="doloires">
      <Doloire x={x + 3} y={y + 8} />
      <Doloire x={x + 27} y={y + 8} flip />
      <Doloire x={x + 15} y={y + 31} />
    </g>
  );
}

const QUARTER_Y = 55;

const fields: Record<BuiltInArms, () => ReactNode> = {
  // D’argent à trois fasces de gueules.
  croy: () => <Fasces />,
  // Écartelé : aux 1 et 4 de Croÿ, aux 2 et 3 de Renty.
  "croy-renty": () => (
    <>
      <Fasces x={0} y={0} width={50} height={QUARTER_Y} />
      <Renty x={50} y={0} />
      <Renty x={0} y={QUARTER_Y} />
      <Fasces x={50} y={QUARTER_Y} width={50} height={120 - QUARTER_Y} />
    </>
  ),
  // Fascé de gueules et d’argent de huit pièces (Árpád).
  "hongrie-ancienne": () => (
    <g data-part="burelles">
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} x={0} y={i * 15} width={100} height={15} />
      ))}
    </g>
  ),
};

type ShieldProps = {
  /** Built-in arms, or nothing for a blank shield (no arms recorded yet). */
  arms?: BuiltInArms;
  /** Accessible name, usually the blazon. Omit only when `decorative`. */
  label?: string;
  decorative?: boolean;
  className?: string;
};

export function Shield({ arms, label, decorative, className }: ShieldProps) {
  const clipId = useId();
  const Field = arms ? fields[arms] : null;

  return (
    <svg
      viewBox="0 0 100 120"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect
          width="100"
          height="120"
          fill={arms ? "var(--argent)" : "var(--paper-2)"}
        />
        {Field && (
          <g fill="var(--croy)">
            <Field />
          </g>
        )}
        {arms === "croy-renty" && (
          <g stroke="var(--croy)" strokeWidth="0.6" opacity="0.5">
            <line x1="50" y1="0" x2="50" y2="120" />
            <line x1="0" y1={QUARTER_Y} x2="100" y2={QUARTER_Y} />
          </g>
        )}
      </g>
      <path
        d={SHIELD_PATH}
        fill="none"
        stroke={arms ? "var(--croy)" : "var(--hairline-strong)"}
        strokeWidth={arms ? 1.4 : 1.2}
        strokeDasharray={arms ? undefined : "3 3"}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
