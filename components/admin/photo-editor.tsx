"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import {
  removePersonFromPhoto,
  reviewPhoto,
  savePhoto,
  setPersonOnPhoto,
  type PhotoFormState,
} from "@/app/[locale]/(admin)/admin/photos/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, SelectField, TextField } from "@/components/ui/field";
import type { EditablePhoto } from "@/lib/data/admin-photos";
import { cn } from "@/lib/design/cn";
import { formatFuzzyDate, parseFuzzyDate } from "@/lib/genealogie/dates";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import {
  FormFooter,
  PersonPicker,
  Translations,
  TreeProvider,
  useFormWords,
  useSaved,
} from "./admin-kit";

type Box = [number, number, number, number];
const initial: PhotoFormState = { status: "idle" };

/**
 * Describing a photo and saying who is on it: drag on the picture to outline
 * a face, then choose the person in the tree. The outline is what lights up
 * when a visitor hovers the name.
 */
export function PhotoEditor({
  photo,
  places,
  events,
  albums,
  locale,
}: {
  photo: EditablePhoto;
  places: { id: string; name: string }[];
  events: { id: string; title: string }[];
  albums: { id: string; title: string }[];
  locale: string;
}) {
  const t = useTranslations("admin.photos");
  const tKinds = useTranslations("photos.kinds");
  const tStatus = useTranslations("status");
  const tLang = useTranslations("common.languages");
  const router = useRouter();
  const words = useFormWords();
  const [state, onSubmit, pending] = useFormAction(savePhoto, initial);
  useSaved(state, () => router.refresh());
  const frame = useRef<HTMLDivElement>(null);
  const start = useRef<[number, number] | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [date, setDate] = useState(
    photo.date ? formatFuzzyDate(photo.date, locale) : "",
  );
  const parsed = date.trim() ? parseFuzzyDate(date) : null;

  const point = (event: PointerEvent): [number, number] => {
    const rect = frame.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ];
  };

  const after =
    (action: (form: FormData) => Promise<void>) => async (form: FormData) => {
      await action(form);
      setDraft(null);
      router.refresh();
    };

  return (
    <TreeProvider locale={locale}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-4">
          <div
            ref={frame}
            className="relative cursor-crosshair touch-none select-none"
            onPointerDown={(event) => {
              (event.target as Element).setPointerCapture?.(event.pointerId);
              start.current = point(event);
              setDraft([...start.current, 0, 0]);
            }}
            onPointerMove={(event) => {
              if (!start.current) return;
              const [x0, y0] = start.current;
              const [x1, y1] = point(event);
              setDraft([
                Math.min(x0, x1),
                Math.min(y0, y1),
                Math.abs(x1 - x0),
                Math.abs(y1 - y0),
              ]);
            }}
            onPointerUp={() => {
              start.current = null;
              setDraft((d) => (d && d[2] > 0.01 && d[3] > 0.01 ? d : null));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
            <img
              src={`/fichiers/${photo.path}?l=1280`}
              alt=""
              draggable={false}
              className="block w-full rounded-xs bg-paper-2"
            />
            {photo.people
              .filter((p) => p.box)
              .map((p) => {
                const [x, y, w, h] = p.box!;
                return (
                  <span
                    key={p.id}
                    className="pointer-events-none absolute rounded-[3px] border-2 border-on-photo shadow-[0_0_0_1px_var(--photo-scrim)]"
                    style={{
                      left: `${x * 100}%`,
                      top: `${y * 100}%`,
                      width: `${w * 100}%`,
                      height: `${h * 100}%`,
                    }}
                  >
                    <span className="absolute top-full left-0 mt-1 rounded-full bg-photo-scrim px-2 text-[0.8125rem] whitespace-nowrap text-on-photo">
                      {p.name}
                    </span>
                  </span>
                );
              })}
            {draft && (
              <span
                className="pointer-events-none absolute rounded-[3px] border-2 border-croy"
                style={{
                  left: `${draft[0] * 100}%`,
                  top: `${draft[1] * 100}%`,
                  width: `${draft[2] * 100}%`,
                  height: `${draft[3] * 100}%`,
                }}
              />
            )}
          </div>
          <p className="text-caption text-ink-muted">{t("drawHint")}</p>

          <form
            action={after(setPersonOnPhoto)}
            className="grid gap-4 rounded-xs border border-hairline p-5"
          >
            <input type="hidden" name="media" value={photo.id} />
            <input
              type="hidden"
              name="box"
              value={draft ? draft.map((n) => n.toFixed(4)).join(",") : ""}
            />
            <p className="font-medium">
              {draft ? t("whoIsOutlined") : t("addPerson")}
            </p>
            <PersonPicker name="person" label={t("person")} locale={locale} />
            <Checkbox name="portrait" label={t("usePortrait")} />
            <div className="flex gap-3">
              <Button type="submit" variant="secondary">
                {t("addToPhoto")}
              </Button>
              {draft && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft(null)}
                >
                  {t("cancelOutline")}
                </Button>
              )}
            </div>
          </form>

          {photo.people.length > 0 && (
            <ul className="grid border-t border-hairline">
              {photo.people.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-4 border-b border-hairline py-2"
                >
                  <span className="min-w-0 flex-1 font-medium">{p.name}</span>
                  <span className="text-caption text-ink-muted">
                    {[
                      p.box ? t("outlined") : t("notOutlined"),
                      p.portrait && t("portrait"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <form action={after(removePersonFromPhoto)}>
                    <input type="hidden" name="media" value={photo.id} />
                    <input type="hidden" name="person" value={p.id} />
                    <button className="link min-h-11 text-caption text-ink-muted">
                      {t("removePerson")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={onSubmit} className="grid content-start gap-6">
          <input type="hidden" name="id" value={photo.id} />
          <TextField
            label={t("caption")}
            name="caption_fr"
            defaultValue={photo.captions.fr}
          />
          <TextField
            label={t("alt")}
            hint={t("altHint")}
            name="alt_fr"
            defaultValue={photo.alts.fr}
          />
          <TextField
            label={t("date")}
            name="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            hint={
              parsed
                ? t("understood", { date: formatFuzzyDate(parsed, locale) })
                : t("dateHint")
            }
            error={
              state.errors?.date || (date.trim() && !parsed)
                ? t("dateInvalid")
                : undefined
            }
          />
          <SelectField label={t("kind")} name="kind" defaultValue={photo.kind}>
            {(
              [
                "photo",
                "portrait",
                "painting",
                "engraving",
                "document",
              ] as const
            ).map((k) => (
              <option key={k} value={k}>
                {tKinds(k)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("place")}
            name="place"
            defaultValue={photo.placeId ?? ""}
          >
            <option value="">{t("none")}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("event")}
            name="event"
            defaultValue={photo.eventId ?? ""}
          >
            <option value="">{t("none")}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("album")}
            name="album"
            defaultValue={photo.albumId ?? ""}
          >
            <option value="">{t("none")}</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t("provenance")}
            name="provenance"
            defaultValue={photo.provenance}
          />
          <TextField
            label={t("credit")}
            name="credit"
            defaultValue={photo.credit}
          />
          <TextField
            label={t("rights")}
            hint={t("rightsHint")}
            name="rights"
            defaultValue={photo.rights}
          />
          <Checkbox
            name="unidentified"
            label={t("unidentified")}
            defaultChecked={photo.unidentified}
          />
          <SelectField
            label={t("state")}
            name="status"
            defaultValue={photo.status}
          >
            {(["pending", "published", "rejected"] as const).map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </SelectField>
          <Translations label={words.translations}>
            {(["en", "de"] as const).map((l) => (
              <fieldset key={l} lang={l} className="grid gap-4">
                <legend className="mb-2 text-caption font-medium text-ink-muted">
                  {tLang(l)}
                </legend>
                <TextField
                  label={t("caption")}
                  name={`caption_${l}`}
                  defaultValue={photo.captions[l]}
                />
                <TextField
                  label={t("alt")}
                  name={`alt_${l}`}
                  defaultValue={photo.alts[l]}
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
          {state.status === "saved" && (
            <p
              role="status"
              className={cn("-mt-3 text-caption text-ink-muted")}
            >
              {t("saved")}
            </p>
          )}
        </form>
      </div>
      <form
        action={async (form) => {
          if (!window.confirm(t("confirmDelete"))) return;
          await reviewPhoto(form);
          router.push("/admin/photos");
        }}
        className="mt-10 border-t border-hairline pt-6"
      >
        <input type="hidden" name="id" value={photo.id} />
        <button
          name="decision"
          value="delete"
          className="link min-h-11 text-caption text-ink-muted"
        >
          {t("delete")}
        </button>
      </form>
    </TreeProvider>
  );
}
