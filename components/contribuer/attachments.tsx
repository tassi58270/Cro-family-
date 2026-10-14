"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { lighter } from "@/lib/photos/lighter";

type Piece = { id: string; name: string; path: string; type: string };

const MAX = 6;

/**
 * Pictures or PDFs joined to a proposal: each one is sent as soon as it is
 * chosen (pictures made lighter first), and only its id goes with the form.
 */
export function Attachments({ name }: { name: string }) {
  const t = useTranslations("contribute.form");
  const id = useId();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [busy, setBusy] = useState(0);
  const [failed, setFailed] = useState(false);

  async function add(files: FileList | null) {
    if (!files) return;
    setFailed(false);
    const chosen = [...files].slice(0, MAX - pieces.length);
    setBusy((n) => n + chosen.length);
    for (const file of chosen) {
      const body = new FormData();
      const isPdf = file.type === "application/pdf";
      body.set(
        "file",
        isPdf ? file : await lighter(file),
        isPdf ? file.name : file.name.replace(/\.[^.]+$/, ".jpg"),
      );
      const answer = await fetch("/api/propositions/piece", {
        method: "POST",
        body,
      })
        .then((r) => (r.ok ? (r.json() as Promise<Omit<Piece, "name">>) : null))
        .catch(() => null);
      if (answer)
        setPieces((list) => [...list, { ...answer, name: file.name }]);
      else setFailed(true);
      setBusy((n) => n - 1);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="font-medium" id={`${id}-label`}>
        {t("attachments")}
      </p>
      <p className="-mt-2 text-caption text-ink-muted">
        {t("attachmentsHint")}
      </p>
      {pieces.map((p) => (
        <input key={p.id} type="hidden" name={name} value={p.id} />
      ))}
      {pieces.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-labelledby={`${id}-label`}>
          {pieces.map((p) => (
            <li
              key={p.id}
              className="flex max-w-full items-center gap-3 rounded-xs border border-hairline py-1.5 pr-1.5 pl-1.5"
            >
              {p.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- a small preview, sized by /fichiers.
                <img
                  src={`/fichiers/${p.path}?l=160`}
                  alt=""
                  className="size-10 rounded-[3px] bg-paper-2 object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-[3px] bg-paper-2 text-[0.6875rem] font-medium text-ink-muted"
                >
                  PDF
                </span>
              )}
              <span className="max-w-48 truncate text-caption">{p.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: p.name })}
                onClick={() =>
                  setPieces((list) => list.filter((x) => x.id !== p.id))
                }
                className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-paper-2 hover:text-ink"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pieces.length + busy < MAX && (
        <div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-hairline-strong px-4 text-caption font-medium transition-colors duration-(--duration-fast) hover:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-croy">
            <input
              type="file"
              accept="image/*,.heic,.heif,application/pdf"
              multiple
              className="sr-only"
              onChange={(event) => {
                add(event.target.files);
                event.target.value = "";
              }}
            />
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            {t("addFile")}
          </label>
        </div>
      )}
      {busy > 0 && (
        <p role="status" className="text-caption text-ink-muted">
          {t("uploading")}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-caption font-medium text-croy-text">
          {t("uploadError")}
        </p>
      )}
    </div>
  );
}
