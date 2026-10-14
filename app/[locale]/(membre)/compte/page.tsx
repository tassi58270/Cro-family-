import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/[locale]/(public)/connexion/actions";
import { ClaimForm } from "@/components/compte/claim-form";
import { ProfileForm } from "@/components/compte/profile-form";
import { BandsRule } from "@/components/ui/bands";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import { PROPOSAL_CHIP } from "@/lib/contributions/states";
import { requireMember, viewerOf } from "@/lib/auth/session";
import { loadMemberSpace } from "@/lib/data/member";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid content-start gap-5 border-t border-hairline pt-8"
    >
      <h2 id={id} className="font-display text-title-sm">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The member space (section 7): who I am in the tree, what I proposed. */
export default async function AccountPage({
  params,
}: PageProps<"/[locale]/compte">) {
  const locale = await resolveLocale(params);
  const session = await requireMember(locale);
  const t = await getTranslations({ locale, namespace: "account" });
  const space = await withViewer(viewerOf(session), (q) =>
    loadMemberSpace(q, session),
  );
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-3xl flex-1 content-start gap-12 py-16 md:py-24"
    >
      <header className="grid gap-5">
        <BandsRule />
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("intro")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/contribuer">{t("propose")}</ButtonLink>
          <ButtonLink href="/compte/histoires" variant="secondary">
            {t("myStories")}
          </ButtonLink>
          <ButtonLink href="/compte/photos" variant="secondary">
            {t("myPhotos")}
          </ButtonLink>
          {session.role === "admin" && (
            <ButtonLink href="/admin" variant="secondary">
              {t("dashboard")}
            </ButtonLink>
          )}
        </div>
      </header>

      <Section id="arbre" title={t("me")}>
        {space.person ? (
          <>
            <p className="text-lead">
              {t("meIs", { name: space.person.name })}
              {space.person.years && (
                <span className="text-ink-muted"> ({space.person.years})</span>
              )}
            </p>
            <ul className="grid gap-1">
              <li>
                <Link
                  href={{
                    pathname: "/arbre",
                    query: { personne: space.person.slug },
                  }}
                  className="link inline-flex min-h-11 items-center font-medium"
                >
                  {t("myPlace")}
                </Link>
              </li>
              <li>
                <Link
                  href={{
                    pathname: "/arbre",
                    query: { vue: "ascendance", depuis: space.person.slug },
                  }}
                  className="link inline-flex min-h-11 items-center font-medium"
                >
                  {t("myAncestors")}
                </Link>
              </li>
              {space.person.branch && (
                <li>
                  <Link
                    href={{
                      pathname: "/branches/[branche]",
                      params: { branche: space.person.branch.slug },
                    }}
                    className="link inline-flex min-h-11 items-center font-medium"
                  >
                    {t("myBranch")} · {space.person.branch.name}
                  </Link>
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <p className="text-ink-muted">{t("meNone")}</p>
            {space.claimPending ? <p>{t("claimSent")}</p> : <ClaimForm />}
          </>
        )}
      </Section>

      <Section id="propositions" title={t("proposals")}>
        {space.proposals.length ? (
          <ul className="grid border-t border-hairline">
            {space.proposals.map((p) => (
              <li
                key={p.id}
                className="grid gap-1 border-b border-hairline py-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">
                    {t(`kinds.${p.kind as "correction"}`)}
                  </span>
                  <StatusChip status={PROPOSAL_CHIP[p.state]}>
                    {t(`states.${p.state}`)}
                  </StatusChip>
                  <span className="text-caption text-ink-muted">
                    {t("sentOn", { date: date.format(new Date(p.createdAt)) })}
                  </span>
                </div>
                {p.summary && <p className="text-ink-muted">{p.summary}</p>}
                {p.reply && (
                  <p className="border-l-2 border-croy pl-3">
                    {t("reply", { reply: p.reply })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("noProposals")}</p>
        )}
      </Section>

      <Section id="profil" title={t("profile")}>
        <p className="text-caption text-ink-muted">
          {t("signedInAs", { email: session.email })}
        </p>
        <ProfileForm displayName={space.displayName} locale={space.locale} />
      </Section>

      <form action={signOut} className="border-t border-hairline pt-8">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="ghost">
          {t("signOut")}
        </Button>
      </form>
    </main>
  );
}
