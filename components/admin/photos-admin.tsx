"use client";

import { useDeferredValue, useState } from "react";
import { useTranslations } from "next-intl";
import {
  answerProposal,
  deleteAlbum,
  reviewPhoto,
  saveAlbum,
  type PhotoFormState,
} from "@/app/[locale]/(admin)/admin/photos/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type {
  AdminAlbum,
  LibraryPhoto,
  PendingPhoto,
  Proposal,
} from "@/lib/data/admin-photos";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { Link, useRouter } from "@/lib/i18n/navigation";
import {
  AdminSection,
  DeleteButton,
  FormFooter,
  Translations,
  useFormWords,
  useSaved,
} from "./admin-kit";

const initial: PhotoFormState = { status: "idle" };

function Act({
  action,
  id,
  decision,
  label,
  strong,
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  decision: string;
  label: string;
  strong?: boolean;
}) {
  const router = useRouter();
  return (
    <form
      action={async (form) => {
        await action(form);
        router.refresh();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        name="decision"
        value={decision}
        className={
          strong
            ? "link min-h-11 text-caption font-medium"
            : "link min-h-11 text-caption text-ink-muted"
        }
      >
        {label}
      </button>
    </form>
  );
}

function AlbumForm({
  item,
  onSaved,
}: {
  item?: AdminAlbum;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.photos");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveAlbum, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("albumTitle")}
        name="title_fr"
        defaultValue={item?.titles.fr}
        error={state.errors?.title_fr ? t("required") : undefined}
      />
      <TextArea
        label={t("albumDescription")}
        name="description_fr"
        rows={3}
        defaultValue={item?.descriptions.fr}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("albumTitle")}
              name={`title_${l}`}
              defaultValue={item?.titles[l]}
            />
            <TextArea
              label={t("albumDescription")}
              name={`description_${l}`}
              rows={2}
              defaultValue={item?.descriptions[l]}
            />
          </fieldset>
        ))}
      </Translations>
      <FormFooter
        pending={pending}
        state={state}
        save={words.save}
        error={words.error}
      />
    </form>
  );
}

function Library({ photos }: { photos: LibraryPhoto[] }) {
  const t = useTranslations("admin.photos");
  const tStatus = useTranslations("status");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());
  const shown = photos.filter(
    (p) => !query || (p.caption ?? "").toLowerCase().includes(query),
  );
  return (
    <AdminSection
      id="bibliotheque"
      title={t("library")}
      intro={t("libraryIntro")}
      action={null}
    >
      <label className="grid max-w-md gap-1">
        <span className="text-caption font-medium">{t("librarySearch")}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-h-12 rounded-full border border-hairline-strong bg-paper px-5"
        />
      </label>
      {shown.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((p) => (
            <li key={p.id} className="grid gap-1">
              <Link
                href={{
                  pathname: "/admin/photos/[photo]",
                  params: { photo: p.id },
                }}
                className="relative block aspect-square overflow-hidden rounded-xs bg-paper-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                <img
                  src={`/fichiers/${p.path}?l=320`}
                  alt={p.caption ?? ""}
                  loading="lazy"
                  className="size-full object-cover"
                />
                {p.status !== "published" && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-paper px-2 text-[0.75rem] font-medium">
                    {tStatus(p.status)}
                  </span>
                )}
              </Link>
              <p className="truncate text-caption text-ink-muted">
                {p.caption || t("noCaption")}
                {p.people > 0 && ` · ${t("peopleCount", { count: p.people })}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{t("libraryNone")}</p>
      )}
    </AdminSection>
  );
}

export function PhotosAdmin({
  pending,
  proposals,
  albums,
  library,
}: {
  pending: PendingPhoto[];
  proposals: Proposal[];
  albums: AdminAlbum[];
  library: LibraryPhoto[];
}) {
  const t = useTranslations("admin.photos");
  const tCommon = useTranslations("admin.lineages");
  const router = useRouter();
  const [panel, setPanel] = useState<{ item?: AdminAlbum } | null>(null);

  return (
    <div className="grid gap-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <h1 className="font-display text-title">{t("title")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
        </div>
        <ButtonLink href="/compte/photos" variant="secondary">
          {t("send")}
        </ButtonLink>
      </header>

      <AdminSection
        id="a-valider"
        title={t("pending")}
        intro={t("pendingIntro")}
        action={null}
      >
        {pending.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <li key={p.id} className="grid gap-2">
                <Link
                  href={{
                    pathname: "/admin/photos/[photo]",
                    params: { photo: p.id },
                  }}
                  className="block aspect-[4/3] overflow-hidden rounded-xs bg-paper-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                  <img
                    src={`/fichiers/${p.path}?l=640`}
                    alt={p.caption ?? ""}
                    className="size-full object-cover"
                  />
                </Link>
                <p className="text-caption">
                  {p.caption && (
                    <span className="font-medium">{p.caption} </span>
                  )}
                  {p.sender && (
                    <span className="text-ink-muted">
                      {t("from", { name: p.sender })}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4">
                  <Act
                    action={reviewPhoto}
                    id={p.id}
                    decision="publish"
                    label={t("publish")}
                    strong
                  />
                  <Link
                    href={{
                      pathname: "/admin/photos/[photo]",
                      params: { photo: p.id },
                    }}
                    className="link min-h-11 content-center text-caption"
                  >
                    {t("describe")}
                  </Link>
                  <Act
                    action={reviewPhoto}
                    id={p.id}
                    decision="reject"
                    label={t("reject")}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("nothingPending")}</p>
        )}
      </AdminSection>

      <AdminSection
        id="propositions"
        title={t("proposals")}
        intro={t("proposalsIntro")}
        action={null}
      >
        {proposals.length ? (
          <ul className="grid border-t border-hairline">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 border-b border-hairline py-4"
              >
                <Link
                  href={{
                    pathname: "/admin/photos/[photo]",
                    params: { photo: p.mediaId },
                  }}
                  className="block aspect-square overflow-hidden rounded-xs bg-paper-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                  <img
                    src={`/fichiers/${p.path}?l=160`}
                    alt=""
                    className="size-full object-cover"
                  />
                </Link>
                <div className="grid gap-1">
                  <p className="font-medium">
                    {p.kind === "identification"
                      ? t("identification", {
                          name: p.personName ?? p.name ?? "?",
                        })
                      : t("removal")}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {[
                      p.author && t("by", { name: p.author }),
                      p.where,
                      p.reason,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="flex flex-wrap gap-x-4">
                    <Act
                      action={answerProposal}
                      id={p.id}
                      decision="accept"
                      label={t("accept")}
                      strong
                    />
                    <Act
                      action={answerProposal}
                      id={p.id}
                      decision="reject"
                      label={t("decline")}
                    />
                  </div>
                  {p.kind === "identification" && !p.personId && (
                    <p className="text-caption text-ink-muted">
                      {t("nameOnly")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("noProposals")}</p>
        )}
      </AdminSection>

      <AdminSection
        id="albums"
        title={t("albums")}
        intro={t("albumsIntro")}
        action={
          <Button variant="secondary" onClick={() => setPanel({})}>
            {t("addAlbum")}
          </Button>
        }
      >
        {albums.length ? (
          <ul className="grid border-t border-hairline">
            {albums.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="font-medium">{a.titles.fr || a.slug}</span>
                  <span className="text-caption text-ink-muted">
                    {t("count", { count: a.count })}
                  </span>
                </span>
                <button
                  type="button"
                  className="link min-h-11 text-caption font-medium"
                  onClick={() => setPanel({ item: a })}
                >
                  {tCommon("edit")}
                </button>
                <DeleteButton
                  action={deleteAlbum}
                  id={a.id}
                  label={tCommon("delete")}
                  confirm={tCommon("confirmDelete")}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("noAlbums")}</p>
        )}
      </AdminSection>

      <Library photos={library} />

      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.item ? t("editAlbum") : t("addAlbum")}
      >
        {panel && (
          <AlbumForm
            key={panel.item?.id ?? "new"}
            item={panel.item}
            onSaved={() => {
              setPanel(null);
              router.refresh();
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}
