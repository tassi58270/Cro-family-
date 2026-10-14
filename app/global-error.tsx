"use client";

import "./globals.css";

const texts = [
  {
    lang: "fr",
    title: "Le site n’a pas pu s’afficher",
    retry: "Réessayer",
  },
  { lang: "en", title: "The site could not be shown", retry: "Try again" },
  {
    lang: "de",
    title: "Die Seite konnte nicht angezeigt werden",
    retry: "Erneut versuchen",
  },
] as const;

/**
 * Last resort, when even the layout fails: its own document, no translations
 * to rely on, so the three languages at once.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body className="grid min-h-dvh place-items-center bg-paper p-6 text-ink">
        <title>Croÿ</title>
        <main className="grid max-w-md gap-6">
          <div aria-hidden="true" className="grid w-10 gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-1 bg-croy" />
            ))}
          </div>
          {texts.map((t) => (
            <section key={t.lang} lang={t.lang} className="grid gap-2">
              <h1 className="text-xl font-semibold">{t.title}</h1>
              <button
                type="button"
                onClick={() => retry()}
                className="justify-self-start font-medium underline decoration-croy decoration-2 underline-offset-4"
              >
                {t.retry}
              </button>
            </section>
          ))}
          {error.digest && (
            <p className="text-sm text-ink-muted tabular-nums">
              {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
