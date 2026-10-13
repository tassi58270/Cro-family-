"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PhotoItem } from "@/lib/data/photo-types";

/**
 * An album shown full screen, one photo after the other (6.5), handy for a
 * family gathering. It only moves on its own once someone presses play.
 */
export function Slideshow({
  photos,
  open,
  onClose,
}: {
  photos: PhotoItem[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("photos.slideshow");
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const touch = useRef<number | null>(null);

  const go = useCallback(
    (step: number) =>
      setIndex((i) => (i + step + photos.length) % photos.length),
    [photos.length],
  );

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.requestFullscreen?.().catch(() => {});
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open || !playing) return;
    const timer = window.setInterval(() => go(1), 5000);
    return () => window.clearInterval(timer);
  }, [open, playing, go]);

  function control(key: "previous" | "next" | "play" | "pause" | "close") {
    if (key === "previous") go(-1);
    else if (key === "next") go(1);
    else if (key === "close") dialog.current?.close();
    else setPlaying((p) => !p);
  }

  const photo = photos[index];
  const next = photos[(index + 1) % photos.length];

  return (
    <dialog
      ref={dialog}
      aria-label={t("label")}
      className="slideshow m-0 size-full max-h-none max-w-none bg-cinema p-0 text-on-photo backdrop:bg-cinema"
      onClose={() => {
        setPlaying(false);
        if (document.fullscreenElement)
          document.exitFullscreen().catch(() => {});
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        else if (event.key === "ArrowLeft") go(-1);
        else if (event.key === " ") {
          event.preventDefault();
          setPlaying((p) => !p);
        }
      }}
      onTouchStart={(event) => {
        touch.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touch.current === null) return;
        const dx = event.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {open && photo && (
        <div className="grid size-full grid-rows-[minmax(0,1fr)_auto]">
          <div className="relative grid place-items-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
            <img
              key={photo.id}
              src={`${photo.url}?l=2048`}
              alt={photo.caption?.text ?? ""}
              className="slide max-h-full max-w-full object-contain"
            />
            {/* The next photo, loaded in advance. */}
            {next && next !== photo && (
              // eslint-disable-next-line @next/next/no-img-element -- preload only.
              <img
                src={`${next.url}?l=2048`}
                alt=""
                aria-hidden="true"
                className="hidden"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
            <p className="min-w-0 flex-1 text-caption" aria-live="polite">
              <span className="tabular opacity-70">
                {t("position", { n: index + 1, total: photos.length })}
              </span>
              {photo.caption && (
                <span className="ml-3">{photo.caption.text}</span>
              )}
            </p>
            {(
              [
                ["previous", "M12.5 4 6.5 10l6 6"],
                [
                  playing ? "pause" : "play",
                  playing ? "M7 4v12M13 4v12" : "M7 4l9 6-9 6Z",
                ],
                ["next", "M7.5 4l6 6-6 6"],
                ["close", "M5 5l10 10M15 5 5 15"],
              ] as const
            ).map(([key, d]) => (
              <button
                key={key}
                type="button"
                onClick={() => control(key)}
                className="grid size-11 place-items-center rounded-full border border-on-photo/40 transition-transform duration-(--duration-press) hover:border-on-photo active:scale-[0.94]"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
                  <path
                    d={d}
                    fill={key === "play" ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="sr-only">{t(key)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}
