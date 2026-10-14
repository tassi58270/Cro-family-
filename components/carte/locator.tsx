"use client";

import { useEffect, useState } from "react";

type Europe = { width: number; height: number; land: string; borders: string };

const VIEW_W = 420;
const VIEW_H = 315;

/**
 * Where a place lies in Europe: the map of the home page, framed around the
 * point (projected on the server), with the two red dots.
 */
export function Locator({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  const [map, setMap] = useState<Europe | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/carte/europe.json")
      .then((r) => r.json() as Promise<Europe>)
      .then((data) => alive && setMap(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const width = map?.width ?? 1000;
  const height = map?.height ?? 860;
  const left = Math.min(Math.max(x - VIEW_W / 2, 0), width - VIEW_W);
  const top = Math.min(Math.max(y - VIEW_H / 2, 0), height - VIEW_H);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${left} ${top} ${VIEW_W} ${VIEW_H}`}
      className="aspect-[4/3] w-full rounded-xs border border-hairline bg-paper"
    >
      {map && (
        <>
          <path d={map.land} className="chapters-land" />
          <path d={map.borders} className="chapters-borders" />
        </>
      )}
      <g transform={`translate(${x} ${y})`} className="fill-croy">
        <circle cx={-5} r={4} />
        <circle cx={5} r={4} />
      </g>
    </svg>
  );
}
