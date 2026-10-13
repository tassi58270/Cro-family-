"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import type { PhotoItem } from "@/lib/data/photo-types";
import { Link } from "@/lib/i18n/navigation";
import { PhotoView } from "./photo-view";

/** A photo page: built in advance for the public, loaded for members otherwise. */
export function PhotoPage({
  id,
  locale,
  initial,
}: {
  id: string;
  locale: string;
  initial: PhotoItem | null;
}) {
  const t = useTranslations("photos");
  const [photo, setPhoto] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "private">(
    initial ? "idle" : "loading",
  );
  useEffect(() => {
    if (initial) return;
    fetch(`/api/photo/${id}?langue=${locale}`, { cache: "no-store" })
      .then((r) =>
        r.ok ? (r.json() as Promise<PhotoItem>) : Promise.reject(r.status),
      )
      .then((p) => {
        setPhoto(p);
        setState("idle");
      })
      .catch(() => setState("private"));
  }, [initial, id, locale]);
  return (
    <div className="grid gap-8">
      <nav className="text-caption">
        <Link
          href="/photos"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("title")}
        </Link>
      </nav>
      {photo ? (
        <PhotoView photo={photo} />
      ) : state === "loading" ? (
        <p role="status" className="text-ink-muted">
          {t("loading")}
        </p>
      ) : (
        <div className="grid justify-items-start gap-4">
          <h1 className="font-display text-title">{t("privateTitle")}</h1>
          <p className="max-w-prose text-ink-muted">{t("privateBody")}</p>
          <ButtonLink href="/connexion">{t("signIn")}</ButtonLink>
        </div>
      )}
    </div>
  );
}
