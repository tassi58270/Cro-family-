import type { ReactNode } from "react";
import { BandsRule } from "./bands";

/**
 * What a visitor sees when a page is missing or fails: the three bands, a
 * plain sentence and a way on, never a dead end (section 5).
 */
export function ErrorScreen({
  code,
  title,
  body,
  actions,
  footnote,
}: {
  code: string;
  title: string;
  body: string;
  actions: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-3xl flex-1 content-center gap-6 py-24 md:py-32"
    >
      <BandsRule />
      <p className="text-caption font-medium text-croy-text tabular-nums">
        {code}
      </p>
      <h1 className="max-w-[20ch] font-display text-title-lg text-balance">
        {title}
      </h1>
      <p className="max-w-prose text-lead text-pretty text-ink-muted">{body}</p>
      <div className="mt-2 flex flex-wrap gap-3">{actions}</div>
      {footnote && (
        <p className="text-caption text-ink-muted tabular-nums">{footnote}</p>
      )}
    </main>
  );
}
