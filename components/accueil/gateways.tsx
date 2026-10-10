import type { ComponentProps, ReactNode } from "react";
import { Shield } from "@/components/heraldique/shield";
import { Link } from "@/lib/i18n/navigation";

/**
 * « Portes d'entrée » (6.1): six large tiles towards the other pages, each
 * with a small living preview: a tree that breathes, shields passing by, a
 * map whose markers blink… Pure CSS, still with reduced motion.
 */

function TreePreview() {
  const nodes: [number, number][] = [
    [100, 22],
    [55, 62],
    [145, 62],
    [30, 104],
    [80, 104],
    [125, 104],
    [170, 104],
  ];
  const links: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
  ];
  return (
    <svg viewBox="0 0 200 126" className="h-full w-full" aria-hidden="true">
      {links.map(([a, b], i) => (
        <path
          key={i}
          d={`M${nodes[a][0]} ${nodes[a][1]} V${(nodes[a][1] + nodes[b][1]) / 2} H${nodes[b][0]} V${nodes[b][1]}`}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeWidth="1.5"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 0 ? 7 : 5.5}
          className="preview-breathe"
          style={{
            animationDelay: `${i * 180}ms`,
            transformOrigin: `${x}px ${y}px`,
          }}
          fill={i === 0 || i === 2 || i === 6 ? "var(--croy)" : "var(--ink)"}
        />
      ))}
    </svg>
  );
}

function ArmsPreview() {
  const arms = ["croy", "croy-renty", "hongrie-ancienne"] as const;
  return (
    <div className="flex h-full items-center overflow-hidden">
      <div className="preview-marquee flex shrink-0 gap-6 pr-6">
        {[...arms, ...arms, ...arms, ...arms].map((a, i) => (
          <Shield key={i} arms={a} decorative className="w-14 shrink-0" />
        ))}
      </div>
    </div>
  );
}

function StoriesPreview() {
  return (
    <div className="grid h-full content-center gap-2.5 px-2" aria-hidden="true">
      <span className="h-3 w-3/4 bg-ink" />
      {[92, 100, 84, 96, 60].map((w, i) => (
        <span
          key={i}
          className="preview-line h-1.5 bg-hairline-strong"
          style={{ width: `${w}%`, animationDelay: `${i * 220}ms` }}
        />
      ))}
    </div>
  );
}

function PhotosPreview() {
  const cells = [
    "col-span-2 row-span-2",
    "",
    "",
    "row-span-2",
    "col-span-2",
    "",
  ];
  return (
    <div
      className="grid h-full grid-cols-4 grid-rows-3 gap-1.5"
      aria-hidden="true"
    >
      {cells.map((c, i) => (
        <span
          key={i}
          className={`preview-photo bg-paper-2 ${c}`}
          style={{ animationDelay: `${i * 400}ms` }}
        />
      ))}
    </div>
  );
}

function PlacesPreview({ points }: { points: [number, number][] }) {
  return (
    <svg viewBox="0 0 200 126" className="h-full w-full" aria-hidden="true">
      <defs>
        <pattern
          id="preview-dots"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="4" cy="4" r="1" fill="var(--hairline-strong)" />
        </pattern>
      </defs>
      <rect width="200" height="126" fill="url(#preview-dots)" />
      {points.slice(0, 5).map(([x, y], i) => (
        <g
          key={i}
          className="preview-blink"
          style={{ animationDelay: `${i * 700}ms` }}
          transform={`translate(${x} ${y})`}
        >
          <circle cx="-3.5" r="3" fill="var(--croy)" />
          <circle cx="3.5" r="3" fill="var(--croy)" />
        </g>
      ))}
    </svg>
  );
}

function ContributePreview() {
  return (
    <div className="grid h-full place-items-center" aria-hidden="true">
      <span className="relative grid size-20 place-items-center">
        <span className="absolute h-[3px] w-full bg-croy" />
        <span className="preview-plus absolute h-full w-[3px] bg-croy" />
      </span>
    </div>
  );
}

type Tile = {
  href: ComponentProps<typeof Link>["href"];
  title: string;
  body: string;
  count?: string | null;
  preview: ReactNode;
};

export function Gateways({
  id,
  title,
  tiles,
}: {
  id: string;
  title: string;
  tiles: Tile[];
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="page border-t border-hairline py-(--section)"
    >
      <div className="mx-auto grid max-w-6xl gap-10">
        <h2 id={`${id}-titre`} className="font-display text-title-lg">
          {title}
        </h2>
        <ul className="grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <li
              key={tile.title}
              className="group relative flex min-w-0 flex-col gap-5 bg-paper p-6 md:p-8"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 grid gap-[3px]"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-[2px] origin-left scale-x-0 bg-croy transition-transform duration-(--duration-base) ease-out group-focus-within:scale-x-100 group-hover:scale-x-100"
                    style={{ transitionDelay: `${i * 50}ms` }}
                  />
                ))}
              </span>
              <div className="aspect-[200/126] w-full overflow-hidden">
                {tile.preview}
              </div>
              <div className="grid gap-2">
                <h3 className="font-display text-title-sm">
                  <Link
                    href={tile.href}
                    className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-offset-[-4px] focus-visible:after:outline-croy"
                  >
                    {tile.title}
                  </Link>
                </h3>
                <p className="text-ink-muted">{tile.body}</p>
                {tile.count && (
                  <p className="tabular text-caption font-medium">
                    {tile.count}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const previews = {
  tree: () => <TreePreview />,
  arms: () => <ArmsPreview />,
  stories: () => <StoriesPreview />,
  photos: () => <PhotosPreview />,
  places: (points: [number, number][]) => <PlacesPreview points={points} />,
  contribute: () => <ContributePreview />,
};
