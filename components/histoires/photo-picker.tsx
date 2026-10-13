"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { PhotoIndex, PhotoItem } from "@/lib/data/photo-types";
import { cn } from "@/lib/design/cn";
import { normalizeForSearch } from "@/lib/search/normalize";

/**
 * Choosing photos for a story among those already on the site; the first
 * one becomes the cover.
 */
export function PhotoPicker({
  name,
  initialIds,
  locale,
}: {
  name: string;
  initialIds: string[];
  locale: string;
}) {
  const t = useTranslations("storyEditor");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [chosen, setChosen] = useState(initialIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/photos/${locale}/membres`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PhotoIndex>) : null))
      .then((index) => index && setPhotos(index.photos))
      .catch(() => {});
  }, [locale]);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const shown = photos.filter((p) => {
    if (!query.trim()) return true;
    const text = normalizeForSearch(
      [p.caption?.text, ...p.people.map((x) => x.name), p.place?.name].join(
        " ",
      ),
    );
    return normalizeForSearch(query)
      .split(" ")
      .every((word) => text.includes(word));
  });
  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 font-medium">{t("photos")}</legend>
      <p className="-mt-1 text-caption text-ink-muted">{t("photosHint")}</p>
      {chosen.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {chosen.map((id, i) => {
            const photo = byId.get(id);
            return (
              <li key={id} className="relative">
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="block size-24 overflow-hidden rounded-xs bg-paper-2 ring-1 ring-hairline"
                >
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers.
                    <img
                      src={`${photo.url}?l=320`}
                      alt={photo.caption?.text ?? ""}
                      className="size-full object-cover"
                    />
                  )}
                  <span className="sr-only">{t("removePhoto")}</span>
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded-full bg-photo-scrim px-2 text-[0.75rem] text-on-photo">
                    {t("cover")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className="link justify-self-start text-caption font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? t("hidePhotos") : t("choosePhotos")}
      </button>
      {open && (
        <div className="grid gap-3 rounded-xs border border-hairline p-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPhotos")}
            aria-label={t("searchPhotos")}
            className="min-h-11 rounded-full border border-hairline-strong bg-paper px-4"
          />
          {shown.length ? (
            <ul className="grid max-h-[24rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
              {shown.slice(0, 60).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={chosen.includes(p.id)}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "block aspect-square w-full overflow-hidden rounded-xs bg-paper-2 transition-[box-shadow,opacity] duration-(--duration-fast)",
                      chosen.includes(p.id)
                        ? "ring-3 ring-croy"
                        : "opacity-90 hover:opacity-100",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                    <img
                      src={`${p.url}?l=320`}
                      alt={p.caption?.text ?? ""}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-ink-muted">{t("noPhotos")}</p>
          )}
        </div>
      )}
    </fieldset>
  );
}
