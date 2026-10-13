"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import type { PersonDetail } from "@/lib/data/person";
import { Link } from "@/lib/i18n/navigation";
import { PersonSheet } from "./person-sheet";

/**
 * The full page of a person. Visitors get the version built in advance;
 * a signed-in member who opens someone the public cannot see (a living
 * relative) gets it from the server with their own rights.
 */
export function PersonPage({
  slug,
  locale,
  initial,
}: {
  slug: string;
  locale: string;
  initial: PersonDetail | null;
}) {
  const t = useTranslations("tree.page");
  const [person, setPerson] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "private">(
    initial ? "idle" : "loading",
  );
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const member = document.cookie
      .split("; ")
      .some((c) => c.startsWith("croy_membre="));
    // The cookie is only readable in the browser, after the static page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(member);
    if (initial) return;
    if (!member) {
      setState("private");
      return;
    }
    fetch(`/api/personne/${encodeURIComponent(slug)}?langue=${locale}`, {
      cache: "no-store",
    })
      .then((r) =>
        r.ok ? (r.json() as Promise<PersonDetail>) : Promise.reject(r.status),
      )
      .then((detail) => {
        setPerson(detail);
        setState("idle");
      })
      .catch(() => setState("private"));
  }, [initial, slug, locale]);

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-(--gutter) pt-8 pb-24 md:pt-14">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-caption">
        <Link
          href="/arbre"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("back")}
        </Link>
        {person && (
          <Link
            href={{ pathname: "/arbre", query: { personne: person.slug } }}
            className="link inline-flex min-h-11 items-center font-medium"
          >
            {t("viewInTree")}
          </Link>
        )}
      </nav>
      {person ? (
        <PersonSheet person={person} headingLevel="h1" signedIn={signedIn} />
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
