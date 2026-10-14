import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { markReviewing } from "@/app/[locale]/(admin)/admin/propositions/actions";
import { DecisionForm } from "@/components/admin/decision-form";
import { PersonChip, StatusChip } from "@/components/ui/chip";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { FIELDS, type SuggestionKind } from "@/lib/contributions/kinds";
import { PROPOSAL_CHIP } from "@/lib/contributions/states";
import { loadProposal } from "@/lib/data/admin-proposals";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/propositions/[proposition]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.proposals" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** One proposal, its content, source and attachments, and the decision. */
export default async function ProposalPage({
  params,
}: PageProps<"/[locale]/admin/propositions/[proposition]">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const { proposition } = await params;
  const proposal = await withViewer(viewerOf(session), (q) =>
    loadProposal(q, proposition),
  );
  if (!proposal) notFound();
  const t = await getTranslations({ locale, namespace: "admin.proposals" });
  const tAccount = await getTranslations({ locale, namespace: "account" });
  const tForm = await getTranslations({ locale, namespace: "contribute.form" });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const fields = (FIELDS[proposal.kind as SuggestionKind] ?? []).filter(
    (f) => proposal.payload[f],
  );
  const open = proposal.state === "sent" || proposal.state === "reviewing";

  return (
    <article className="grid max-w-3xl gap-10">
      <nav className="text-caption">
        <Link
          href="/admin/propositions"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("back")}
        </Link>
      </nav>
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={PROPOSAL_CHIP[proposal.state]}>
            {tAccount(`states.${proposal.state}`)}
          </StatusChip>
          <span className="text-caption text-ink-muted">
            {t("from", {
              name:
                proposal.authorEmail && proposal.authorEmail !== proposal.author
                  ? `${proposal.author} (${proposal.authorEmail})`
                  : proposal.author,
            })}{" "}
            · {date.format(new Date(proposal.createdAt))}
          </span>
        </div>
        <h1 className="font-display text-title">
          {tAccount(`kinds.${proposal.kind as "correction"}`)}
          {proposal.summary && proposal.kind !== "correction" && (
            <span className="text-ink-muted"> · {proposal.summary}</span>
          )}
        </h1>
      </header>

      {proposal.target && (
        <section className="grid gap-3">
          <h2 className="text-caption font-medium text-ink-muted">
            {t("about")}
          </h2>
          <div>
            <PersonChip
              name={
                proposal.target.years
                  ? `${proposal.target.name} (${proposal.target.years})`
                  : proposal.target.name
              }
              href={{
                pathname: "/arbre/[personne]",
                params: { personne: proposal.target.slug },
              }}
            />
          </div>
        </section>
      )}

      {fields.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-caption font-medium text-ink-muted">
            {t("content")}
          </h2>
          <dl className="grid border-t border-hairline">
            {fields.map((f) => (
              <div
                key={f}
                className="grid gap-1 border-b border-hairline py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
              >
                <dt className="text-caption text-ink-muted">
                  {t(`fields.${f}`)}
                </dt>
                <dd className="whitespace-pre-line">
                  {f === "relation"
                    ? tForm(`relations.${proposal.payload.relation!}`)
                    : proposal.payload[f]}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {proposal.source && (
        <section className="grid gap-2">
          <h2 className="text-caption font-medium text-ink-muted">
            {t("source")}
          </h2>
          <p className="whitespace-pre-line">{proposal.source}</p>
        </section>
      )}

      {proposal.attachments.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-caption font-medium text-ink-muted">
            {t("attachments")}
          </h2>
          <ul className="flex flex-wrap gap-3">
            {proposal.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/fichiers/${a.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid w-40 gap-2 text-caption"
                >
                  {a.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers.
                    <img
                      src={`/fichiers/${a.path}?l=320`}
                      alt=""
                      className="aspect-square w-full rounded-xs bg-paper-2 object-cover"
                    />
                  ) : (
                    <span className="grid aspect-square w-full place-items-center rounded-xs bg-paper-2 font-medium text-ink-muted">
                      PDF
                    </span>
                  )}
                  <span className="link truncate">{a.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open ? (
        <section className="grid gap-5 border-t border-hairline pt-8">
          <p className="text-caption text-ink-muted">
            {proposal.kind === "claim" ? t("claimNote") : t("applyNote")}
          </p>
          {proposal.kind === "person" || proposal.kind === "correction" ? (
            <p>
              <Link href="/admin/arbre" className="link font-medium">
                {t("openTree")}
              </Link>
            </p>
          ) : null}
          {proposal.state === "sent" && (
            <form action={markReviewing}>
              <input type="hidden" name="id" value={proposal.id} />
              <button className="link min-h-11 text-caption font-medium">
                {t("review")}
              </button>
            </form>
          )}
          <DecisionForm id={proposal.id} />
        </section>
      ) : (
        <section className="grid gap-2 border-t border-hairline pt-8">
          <p className="font-medium">
            {t("decided", {
              state: tAccount(`states.${proposal.state}`),
              date: proposal.reviewedAt
                ? date.format(new Date(proposal.reviewedAt))
                : "—",
            })}
          </p>
          {proposal.reply && (
            <p className="border-l-2 border-croy pl-3">{proposal.reply}</p>
          )}
        </section>
      )}
    </article>
  );
}
