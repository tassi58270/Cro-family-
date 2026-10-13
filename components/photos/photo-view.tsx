"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  proposeName,
  requestRemoval,
  type PhotoRequestState,
} from "@/app/[locale]/(public)/photos/actions";
import { PersonPicker, TreeProvider } from "@/components/admin/admin-kit";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import type { PhotoItem } from "@/lib/data/photo-types";
import { cn } from "@/lib/design/cn";
import { formatFuzzyDate } from "@/lib/genealogie/dates";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { Link } from "@/lib/i18n/navigation";

/**
 * One photo (6.5): large, with its caption, date, place, author and the
 * people on it. Hovering a name outlines that person on the photo; members
 * may name someone not yet identified, or ask for the photo to be removed.
 */

const initial: PhotoRequestState = { status: "idle" };

function ProposeName({ photo }: { photo: PhotoItem }) {
  const t = useTranslations("photos.photo");
  const locale = useLocale();
  const [state, onSubmit, pending] = useFormAction(proposeName, initial);
  if (state.status === "sent") {
    return (
      <p role="status" className="text-caption">
        {t("proposalSent")}
      </p>
    );
  }
  return (
    <TreeProvider locale={locale}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <input type="hidden" name="photo" value={photo.id} />
        <PersonPicker name="person" label={t("whoInTree")} locale={locale} />
        <TextField label={t("whoName")} hint={t("whoNameHint")} name="name" />
        <TextField label={t("where")} hint={t("whereHint")} name="where" />
        {state.status === "invalid" && (
          <p role="alert" className="text-caption text-croy-text">
            {t("proposalInvalid")}
          </p>
        )}
        <Button type="submit" variant="secondary" busy={pending}>
          {t("propose")}
        </Button>
      </form>
    </TreeProvider>
  );
}

function RequestRemoval({ photo }: { photo: PhotoItem }) {
  const t = useTranslations("photos.photo");
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useFormAction(requestRemoval, initial);
  if (state.status === "sent") {
    return (
      <p role="status" className="text-caption">
        {t("removalSent")}
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="link justify-self-start text-caption text-ink-muted"
      >
        {t("removal")}
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="photo" value={photo.id} />
      <TextArea
        label={t("removalReason")}
        hint={t("removalHint")}
        name="reason"
        rows={3}
      />
      <Button type="submit" variant="secondary" busy={pending}>
        {t("removalSend")}
      </Button>
    </form>
  );
}

export function PhotoView({ photo }: { photo: PhotoItem }) {
  const t = useTranslations("photos.photo");
  const tKinds = useTranslations("photos.kinds");
  const locale = useLocale();
  const [active, setActive] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    // The cookie is only readable in the browser, after the static page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(
      document.cookie.split("; ").some((c) => c.startsWith("croy_membre=")),
    );
  }, []);
  const boxed = photo.people.filter((p) => p.box);
  const label = photo.caption?.text ?? photo.alt ?? "";

  return (
    <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <figure className="grid justify-items-center lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
        <div className="group relative inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
          <img
            src={`${photo.url}?l=2048`}
            alt={label}
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            className="block h-auto max-h-[82svh] w-auto max-w-full rounded-xs bg-paper-2"
          />
          {boxed.map((p) => {
            const [x, y, w, h] = p.box!;
            const on = active === p.id;
            return (
              <span
                key={p.id}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute rounded-[3px] border-2 transition-[opacity,border-color] duration-(--duration-fast)",
                  on
                    ? "border-croy opacity-100"
                    : active
                      ? "opacity-0"
                      : "border-on-photo/80 opacity-0 group-hover:opacity-100",
                )}
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${w * 100}%`,
                  height: `${h * 100}%`,
                }}
              >
                <span
                  className={cn(
                    "absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-full bg-photo-scrim px-2 text-[0.8125rem] whitespace-nowrap text-on-photo",
                    !on && "max-md:hidden",
                  )}
                >
                  {p.name}
                </span>
              </span>
            );
          })}
        </div>
      </figure>

      <div className="grid content-start gap-6">
        <header className="grid gap-2">
          <p className="text-caption text-ink-muted">
            {[
              tKinds(photo.kind),
              photo.date && formatFuzzyDate(photo.date, locale),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {photo.caption && (
            <h1
              className="font-display text-title-sm"
              lang={photo.caption.lang}
            >
              {photo.caption.text}
            </h1>
          )}
          {photo.isDemo && (
            <p className="text-caption text-croy-text">{t("demo")}</p>
          )}
          {photo.status !== "published" && (
            <p className="justify-self-start rounded-full border border-hairline-strong px-3 text-caption leading-8">
              {t("pending")}
            </p>
          )}
        </header>

        {photo.people.length > 0 && (
          <section
            aria-labelledby="sur-la-photo"
            className="grid gap-2 border-t border-hairline pt-5"
          >
            <h2
              id="sur-la-photo"
              className="text-caption font-medium text-ink-muted"
            >
              {t("people")}
            </h2>
            <ul className="grid gap-1">
              {photo.people.map((p) => (
                <li key={p.id}>
                  {p.slug ? (
                    <Link
                      href={{
                        pathname: "/arbre/[personne]",
                        params: { personne: p.slug },
                      }}
                      onPointerEnter={() => setActive(p.id)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(p.id)}
                      onBlur={() => setActive(null)}
                      className="link inline-flex min-h-10 items-center"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">{p.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <dl className="grid gap-x-6 gap-y-2 border-t border-hairline pt-5 text-caption sm:grid-cols-[auto_minmax(0,1fr)]">
          {photo.place && (
            <>
              <dt className="font-medium">{t("place")}</dt>
              <dd>
                <Link
                  href={{
                    pathname: "/lieux/[lieu]",
                    params: { lieu: photo.place.slug },
                  }}
                  className="link"
                >
                  {photo.place.name}
                </Link>
              </dd>
            </>
          )}
          {photo.event && (
            <>
              <dt className="font-medium">{t("event")}</dt>
              <dd>{photo.event.title}</dd>
            </>
          )}
          {photo.album && (
            <>
              <dt className="font-medium">{t("album")}</dt>
              <dd>
                <Link
                  href={{
                    pathname: "/photos/albums/[album]",
                    params: { album: photo.album.slug },
                  }}
                  className="link"
                >
                  {photo.album.title}
                </Link>
              </dd>
            </>
          )}
          {photo.provenance && (
            <>
              <dt className="font-medium">{t("provenance")}</dt>
              <dd>{photo.provenance}</dd>
            </>
          )}
          {photo.credit && (
            <>
              <dt className="font-medium">{t("credit")}</dt>
              <dd>{photo.credit}</dd>
            </>
          )}
        </dl>

        {photo.unidentified && (
          <section
            aria-labelledby="qui-est-ce"
            className="grid gap-4 rounded-xs bg-paper-2 p-5"
          >
            <h2 id="qui-est-ce" className="font-display text-title-sm">
              {t("who")}
            </h2>
            <p className="text-caption text-ink-muted">{t("whoBody")}</p>
            {signedIn ? (
              <ProposeName photo={photo} />
            ) : (
              <Link
                href="/connexion"
                className="link justify-self-start text-caption font-medium"
              >
                {t("signInToHelp")}
              </Link>
            )}
          </section>
        )}

        {signedIn && <RequestRemoval photo={photo} />}
      </div>
    </article>
  );
}
