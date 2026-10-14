import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatusChip } from "@/components/ui/chip";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { PROPOSAL_CHIP } from "@/lib/contributions/states";
import { loadProposals, type ProposalRow } from "@/lib/data/admin-proposals";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/propositions">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.proposals" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The queue of what members propose (section 7). */
export default async function ProposalsPage({
  params,
}: PageProps<"/[locale]/admin/propositions">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.proposals" });
  const tAccount = await getTranslations({ locale, namespace: "account" });
  const tNav = await getTranslations({ locale, namespace: "admin.nav" });
  const { open, closed } = await withViewer(viewerOf(session), loadProposals);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const list = (rows: ProposalRow[], empty: string) =>
    rows.length ? (
      <ul className="grid border-t border-hairline">
        {rows.map((p) => (
          <li key={p.id} className="border-b border-hairline">
            <Link
              href={{
                pathname: "/admin/propositions/[proposition]",
                params: { proposition: p.id },
              }}
              className="grid gap-1 py-4 transition-colors duration-(--duration-fast) hover:bg-paper-2 md:px-3"
            >
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">
                  {tAccount(`kinds.${p.kind as "correction"}`)}
                </span>
                <StatusChip status={PROPOSAL_CHIP[p.state]}>
                  {tAccount(`states.${p.state}`)}
                </StatusChip>
                <span className="text-caption text-ink-muted">
                  {t("from", { name: p.author })} ·{" "}
                  {date.format(new Date(p.createdAt))}
                </span>
              </span>
              {p.summary && (
                <span className="truncate text-ink-muted">{p.summary}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-ink-muted">{empty}</p>
    );

  return (
    <div className="grid gap-12">
      <header className="grid gap-2">
        <h1 className="font-display text-title">{t("title")}</h1>
        <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
        <p className="text-caption text-ink-muted">
          {t("photosNote")}{" "}
          <Link href="/admin/photos" className="link">
            {tNav("photos")}
          </Link>
        </p>
      </header>
      <section aria-labelledby="ouvertes" className="grid gap-4">
        <h2 id="ouvertes" className="font-display text-title-sm">
          {t("open")}
        </h2>
        {list(open, t("none"))}
      </section>
      <section aria-labelledby="traitees" className="grid gap-4">
        <h2 id="traitees" className="font-display text-title-sm">
          {t("closed")}
        </h2>
        {list(closed, t("noneClosed"))}
      </section>
    </div>
  );
}
