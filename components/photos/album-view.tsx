"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { PhotoIndex, PhotoItem } from "@/lib/data/photo-types";
import { JustifiedWall } from "./justified-wall";
import { Slideshow } from "./slideshow";

/** An album: its photos, and the slideshow. Members also see private ones. */
export function AlbumView({
  slug,
  initial,
  locale,
}: {
  slug: string;
  initial: PhotoItem[];
  locale: string;
}) {
  const t = useTranslations("photos");
  const [photos, setPhotos] = useState(initial);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c.startsWith("croy_membre=")))
      return;
    fetch(`/api/photos/${locale}/membres`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PhotoIndex>) : null))
      .then(
        (index) =>
          index &&
          setPhotos(index.photos.filter((p) => p.album?.slug === slug)),
      )
      .catch(() => {});
  }, [slug, locale]);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-4 px-(--gutter)">
        <p className="text-caption text-ink-muted">
          {t("albumCount", { count: photos.length })}
        </p>
        {photos.length > 0 && (
          <Button variant="secondary" onClick={() => setPlaying(true)}>
            {t("slideshow.start")}
          </Button>
        )}
      </div>
      <div className="px-2 md:px-4">
        <JustifiedWall photos={photos} label={t("views.albums")} />
      </div>
      <Slideshow
        photos={photos}
        open={playing}
        onClose={() => setPlaying(false)}
      />
    </div>
  );
}
