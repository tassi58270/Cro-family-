import Link from "next/link";
import "./globals.css";

const homes = [
  { href: "/fr", label: "Accueil", lang: "fr" },
  { href: "/en", label: "Home", lang: "en" },
  { href: "/de", label: "Startseite", lang: "de" },
] as const;

/**
 * Last-resort 404, for the rare URLs the language proxy does not handle
 * (for example a missing file). Localized 404s live in `app/[locale]/not-found.tsx`.
 */
export default function RootNotFound() {
  return (
    <html lang="fr">
      <body className="grid min-h-dvh place-items-center bg-paper p-6 text-ink">
        <main className="max-w-md text-center">
          <h1 className="text-3xl font-semibold">Page introuvable</h1>
          <ul className="mt-4 flex justify-center gap-4 text-ink-muted">
            {homes.map(({ href, label, lang }) => (
              <li key={href} lang={lang}>
                <Link className="underline underline-offset-4" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  );
}
