"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PeoplePicker, TreeProvider } from "@/components/admin/admin-kit";
import { Button } from "@/components/ui/button";
import { Checkbox, SelectField, TextField } from "@/components/ui/field";
import { cn } from "@/lib/design/cn";
import { parseFuzzyDate, formatFuzzyDate } from "@/lib/genealogie/dates";
import { useRouter } from "@/lib/i18n/navigation";
import { lighter } from "@/lib/photos/lighter";

/**
 * Sending several photos at once, from a phone or a computer (6.5): what
 * they have in common (date, place, album, people) once, a caption for each.
 * Each photo is made lighter in the browser before it leaves.
 */

type Item = {
  key: string;
  file: File;
  preview: string;
  caption: string;
  state: "ready" | "sending" | "sent" | "error";
};

export function PhotoUploader({
  locale,
  places,
  albums,
  admin,
}: {
  locale: string;
  places: { id: string; name: string }[];
  albums: { id: string; title: string }[];
  admin: boolean;
}) {
  const t = useTranslations("photos.upload");
  const tKinds = useTranslations("photos.kinds");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const shared = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const parsed = date.trim() ? parseFuzzyDate(date) : null;

  // Previews are freed when they leave the list or the page closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const current = new Set(items.map((i) => i.preview));
    for (const url of previews.current)
      if (!current.has(url)) URL.revokeObjectURL(url);
    previews.current = current;
  }, [items]);
  useEffect(
    () => () => previews.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  function add(files: FileList | null) {
    if (!files) return;
    setDone(null);
    setItems((current) => [
      ...current,
      ...[...files]
        .filter(
          (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
        )
        .map((file) => ({
          key: `${file.name}-${file.size}-${Math.random()}`,
          file,
          preview: URL.createObjectURL(file),
          caption: "",
          state: "ready" as const,
        })),
    ]);
  }

  async function send() {
    if (!shared.current) return;
    setBusy(true);
    const form = new FormData(shared.current);
    const meta = {
      date: date.trim() || undefined,
      place: String(form.get("place") ?? ""),
      album: String(form.get("album") ?? ""),
      people: form.getAll("people").map(String),
      unidentified: form.get("unidentified") === "on",
      provenance: String(form.get("provenance") ?? ""),
      credit: String(form.get("credit") ?? ""),
      kind: String(form.get("kind") ?? "photo"),
      locale,
    };
    let sent = 0;
    for (const item of items) {
      if (item.state === "sent") continue;
      setItems((list) =>
        list.map((i) => (i.key === item.key ? { ...i, state: "sending" } : i)),
      );
      const body = new FormData();
      body.set(
        "file",
        await lighter(item.file),
        item.file.name.replace(/\.[^.]+$/, ".jpg"),
      );
      body.set("meta", JSON.stringify({ ...meta, caption: item.caption }));
      const ok = await fetch("/api/photos/envoi", { method: "POST", body })
        .then((r) => r.ok)
        .catch(() => false);
      if (ok) sent++;
      setItems((list) =>
        list.map((i) =>
          i.key === item.key ? { ...i, state: ok ? "sent" : "error" } : i,
        ),
      );
    }
    setBusy(false);
    setDone(sent);
    router.refresh();
  }

  const waiting = items.filter((i) => i.state !== "sent").length;

  return (
    <TreeProvider locale={locale}>
      <div className="grid gap-10">
        <div className="grid gap-4">
          <input
            ref={input}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            id="photos-input"
            onChange={(event) => {
              add(event.target.files);
              event.target.value = "";
            }}
          />
          <label
            htmlFor="photos-input"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              add(event.dataTransfer.files);
            }}
            className="grid cursor-pointer place-items-center gap-2 rounded-xs border-2 border-dashed border-hairline-strong px-6 py-12 text-center transition-colors duration-(--duration-fast) hover:border-ink"
          >
            <span className="font-display text-title-sm">{t("choose")}</span>
            <span className="text-caption text-ink-muted">
              {t("chooseHint")}
            </span>
          </label>
        </div>

        {items.length > 0 && (
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={t("selected")}
          >
            {items.map((item) => (
              <li
                key={item.key}
                className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview. */}
                <img
                  src={item.preview}
                  alt=""
                  className="aspect-square w-24 rounded-xs bg-paper-2 object-cover"
                />
                <div className="grid content-start gap-2">
                  <label className="grid gap-1 text-caption">
                    <span className="font-medium">{t("caption")}</span>
                    <input
                      value={item.caption}
                      disabled={item.state === "sent" || busy}
                      onChange={(event) =>
                        setItems((list) =>
                          list.map((i) =>
                            i.key === item.key
                              ? { ...i, caption: event.target.value }
                              : i,
                          ),
                        )
                      }
                      className="min-h-11 w-full rounded-xs border border-hairline-strong bg-paper px-3 text-body"
                    />
                  </label>
                  <p
                    className={cn(
                      "text-caption",
                      item.state === "error"
                        ? "text-croy-text"
                        : "text-ink-muted",
                    )}
                  >
                    {t(`state.${item.state}`)}
                    {item.state === "ready" && !busy && (
                      <button
                        type="button"
                        className="link ml-3"
                        onClick={() =>
                          setItems((list) =>
                            list.filter((i) => i.key !== item.key),
                          )
                        }
                      >
                        {t("remove")}
                      </button>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          ref={shared}
          onSubmit={(event) => event.preventDefault()}
          className="grid max-w-3xl gap-6"
        >
          <h2 className="font-display text-title-sm">{t("together")}</h2>
          <TextField
            label={t("date")}
            hint={
              parsed
                ? t("understood", { date: formatFuzzyDate(parsed, locale) })
                : t("dateHint")
            }
            error={date.trim() && !parsed ? t("dateInvalid") : undefined}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <SelectField label={t("kind")} name="kind" defaultValue="photo">
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
          {places.length > 0 && (
            <SelectField label={t("place")} name="place" defaultValue="">
              <option value="">{t("none")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          )}
          {albums.length > 0 && (
            <SelectField label={t("album")} name="album" defaultValue="">
              <option value="">{t("none")}</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </SelectField>
          )}
          <PeoplePicker
            name="people"
            label={t("people")}
            hint={t("peopleHint")}
            initialIds={[]}
            locale={locale}
          />
          <Checkbox
            name="unidentified"
            label={t("unidentified")}
            hint={t("unidentifiedHint")}
          />
          <TextField
            label={t("provenance")}
            hint={t("provenanceHint")}
            name="provenance"
          />
          <TextField label={t("credit")} name="credit" />
        </form>

        <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-6">
          <Button
            onClick={send}
            busy={busy}
            disabled={!waiting || busy || Boolean(date.trim() && !parsed)}
          >
            {t("send", { count: waiting })}
          </Button>
          {done !== null && (
            <p role="status" className="text-caption">
              {admin
                ? t("doneAdmin", { count: done })
                : t("done", { count: done })}
            </p>
          )}
        </div>
        {!admin && (
          <p className="text-caption text-ink-muted">{t("validation")}</p>
        )}
      </div>
    </TreeProvider>
  );
}
