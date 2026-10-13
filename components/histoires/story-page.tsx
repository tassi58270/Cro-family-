"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import type { StoryDetail } from "@/lib/data/story-types";
import { Link } from "@/lib/i18n/navigation";
import { StoryReader } from "./story-reader";

/**
 * A story page: the version built in advance for the public, or, for a
 * member opening a story about living relatives, the one the server gives
 * them with their own rights.
 */
export function StoryPage({
  slug,
  locale,
  initial,
}: {
  slug: string;
  locale: string;
  initial: StoryDetail | null;
}) {
  const t = useTranslations("stories");
  const [story, setStory] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "private">(
    initial ? "idle" : "loading",
  );
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (initial) return;
    const member = document.cookie
      .split("; ")
      .some((c) => c.startsWith("croy_membre="));
    // The cookie is only readable in the browser, after the static page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(member);
    fetch(`/api/histoire/${encodeURIComponent(slug)}?langue=${locale}`, {
      cache: "no-store",
    })
      .then((r) =>
        r.ok ? (r.json() as Promise<StoryDetail>) : Promise.reject(r.status),
      )
      .then((detail) => {
        setStory(detail);
        setState("idle");
      })
      .catch(() => setState("private"));
  }, [initial, slug, locale]);

  return (
    <div className="grid gap-8">
      <nav className="text-caption">
        <Link
          href="/histoires"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("title")}
        </Link>
      </nav>
      {story ? (
        <StoryReader story={story} locale={locale} />
      ) : state === "loading" ? (
        <p role="status" className="text-ink-muted">
          {t("loading")}
        </p>
      ) : (
        <div className="grid justify-items-start gap-4">
          <h1 className="font-display text-title">{t("privateTitle")}</h1>
          <p className="max-w-prose text-ink-muted">{t("privateBody")}</p>
          {!signedIn && (
            <ButtonLink href="/connexion">{t("signIn")}</ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}
