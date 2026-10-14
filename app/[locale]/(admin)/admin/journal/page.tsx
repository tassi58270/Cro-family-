import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JournalView } from "@/components/admin/journal-view";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadJournal } from "@/lib/data/journal";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/journal">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.journal" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

const PAGE = 40;

/** Every change, newest first, each one undoable (section 7). */
export default async function JournalPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/journal">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.journal" });
  const before = (await searchParams).avant;
  const from =
    typeof before === "string" && !Number.isNaN(Date.parse(before))
      ? before
      : null;
  const changes = await withViewer(viewerOf(session), (q) =>
    loadJournal(q, { before: from, limit: PAGE }),
  );
  const last = changes.at(-1);
  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <h1 className="font-display text-title">{t("title")}</h1>
        <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
      </header>
      <JournalView changes={changes} locale={locale} />
      <nav className="flex flex-wrap gap-6 text-caption">
        {from && (
          <Link href="/admin/journal" className="link min-h-11 font-medium">
            {t("newest")}
          </Link>
        )}
        {changes.length === PAGE && last && (
          <Link
            href={{ pathname: "/admin/journal", query: { avant: last.at } }}
            className="link min-h-11 font-medium"
          >
            {t("older")}
          </Link>
        )}
      </nav>
    </div>
  );
}
