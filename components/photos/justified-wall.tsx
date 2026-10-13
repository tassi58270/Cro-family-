"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoItem } from "@/lib/data/photo-types";
import { Link } from "@/lib/i18n/navigation";
import { justify } from "@/lib/photos/justify";

const STEP = 36;

/**
 * Photos in a justified mosaic, loaded as the page scrolls (6.5). Each photo
 * opens its own page.
 */
export function JustifiedWall({
  photos,
  label,
}: {
  photos: PhotoItem[];
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(STEP);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShown((n) => n + STEP),
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [photos]);

  const visible = photos.slice(0, shown);
  const narrow = width < 640;
  const rows = width
    ? justify(
        visible.map((p) => (p.width && p.height ? p.width / p.height : 1.4)),
        width,
        narrow ? 150 : 260,
        narrow ? 4 : 8,
      )
    : [];

  return (
    <div ref={box} className="grid" aria-label={label} role="list">
      <div className="grid" style={{ gap: narrow ? 4 : 8 }}>
        {rows.map((row, r) => (
          <div
            key={r}
            className="flex"
            style={{ gap: narrow ? 4 : 8, height: row.height }}
          >
            {row.tiles.map((tile) => {
              const photo = visible[tile.index];
              const label = photo.caption?.text ?? photo.alt ?? "";
              return (
                <Link
                  key={photo.id}
                  role="listitem"
                  href={{
                    pathname: "/photos/[photo]",
                    params: { photo: photo.id },
                  }}
                  className="group relative block shrink-0 overflow-hidden rounded-xs bg-paper-2"
                  style={{ width: tile.width, height: tile.height }}
                  aria-label={label || undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                  <img
                    src={`${photo.url}?l=${tile.height > 300 || tile.width > 600 ? 1280 : 640}`}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-(--duration-slow) ease-out group-hover:scale-[1.03]"
                  />
                  {label && !narrow && (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-photo-scrim to-transparent px-3 pt-8 pb-2.5 text-caption text-on-photo opacity-0 transition-[opacity,transform] duration-(--duration-fast) group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      <span className="line-clamp-2">{label}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      {shown < photos.length && <div ref={sentinel} className="h-px" />}
    </div>
  );
}
