import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArmsImage } from "@/components/armoiries/arms-gallery";
import { extinctionLine, PersonName } from "@/components/armoiries/branch-card";
import { branchColor } from "@/components/armoiries/branch-color";
import { branchSlugs, loadBranchPage } from "@/lib/data/arms";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";
import { EditLink } from "@/components/ui/edit-link";

export async function generateStaticParams() {
  return (await branchSlugs()).map((branche) => ({ branche }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/branches/[branche]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { branche } = await params;
  const data = await loadBranchPage(branche, locale);
  return data
    ? {
        title: data.branch.name,
        description: data.branch.description ?? undefined,
      }
    : {};
}

/** One branch: its story, its people and its place in the tree (6.3). */
export default async function BranchPage({
  params,
}: PageProps<"/[locale]/branches/[branche]">) {
  const locale = await resolveLocale(params);
  const { branche } = await params;
  const data = await loadBranchPage(branche, locale);
  if (!data) notFound();
  const t = await getTranslations({ locale, namespace: "armsPage.branches" });
  const tPage = await getTranslations({ locale, namespace: "armsPage" });
  const { branch, branches, arms, members, living } = data;
  const index = branches.indexOf(branches.find((b) => b.id === branch.id)!);
  const parent = branches.find((b) => b.slug === branch.parent);
  const children = branches.filter((b) => b.parent === branch.slug);
  const shield = branch.arms >= 0 ? arms[branch.arms] : undefined;
  const treeHref = branch.founder?.slug
    ? { pathname: "/arbre" as const, query: { depuis: branch.founder.slug } }
    : { pathname: "/arbre" as const, query: { vue: "branches" } };

  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-4xl gap-12 px-(--gutter) pt-8 pb-28 md:pt-14"
    >
      <EditLink href="/admin/armoiries" />
      <nav className="text-caption">
        <Link
          href="/armoiries"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {tPage("title")}
        </Link>
      </nav>
      <header
        className="grid gap-6 border-t-4 pt-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10"
        style={{ borderColor: branchColor(branch, index) }}
      >
        {shield && <ArmsImage item={shield} className="w-20 md:w-28" />}
        <div className="grid content-start gap-3">
          <h1 className="font-display text-title-lg">{branch.name}</h1>
          <p className="tabular text-ink-muted">
            {[
              branch.start && t("since", { year: branch.start }),
              extinctionLine(t, branch),
              t("people", { count: branch.people }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {branch.isDemo && (
            <p className="text-caption text-croy-text">
              {tPage("gallery.demo")}
            </p>
          )}
        </div>
      </header>

      {branch.description && (
        <p className="max-w-prose text-lead">{branch.description}</p>
      )}

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        {branch.founder && (
          <>
            <dt className="font-medium">{t("founder")}</dt>
            <dd>
              <PersonName person={branch.founder} />
            </dd>
          </>
        )}
        {branch.last && (
          <>
            <dt className="font-medium">{t("last")}</dt>
            <dd>
              <PersonName person={branch.last} />
            </dd>
          </>
        )}
        {parent && (
          <>
            <dt className="font-medium">{t("parent")}</dt>
            <dd>
              <Link
                href={{
                  pathname: "/branches/[branche]",
                  params: { branche: parent.slug },
                }}
                className="link"
              >
                {parent.name}
              </Link>
            </dd>
          </>
        )}
        {children.length > 0 && (
          <>
            <dt className="font-medium">{t("children")}</dt>
            <dd className="flex flex-wrap gap-x-4">
              {children.map((c) => (
                <Link
                  key={c.slug}
                  href={{
                    pathname: "/branches/[branche]",
                    params: { branche: c.slug },
                  }}
                  className="link"
                >
                  {c.name}
                </Link>
              ))}
            </dd>
          </>
        )}
      </dl>

      {branch.fate && (
        <section
          aria-labelledby="devenir"
          className="grid gap-3 border-l-2 border-hairline-strong pl-5"
        >
          <h2 id="devenir" className="text-caption font-medium text-ink-muted">
            {t("fate")}
          </h2>
          <p className="max-w-prose">{branch.fate}</p>
        </section>
      )}

      <p>
        <Link href={treeHref} className="link font-medium">
          {t("inTree")}
        </Link>
      </p>

      <section aria-labelledby="membres" className="grid gap-4">
        <h2 id="membres" className="font-display text-title-sm">
          {t("members")}
        </h2>
        {members.length ? (
          <ul className="grid border-t border-hairline sm:grid-cols-2 sm:gap-x-10">
            {members.map((m) => (
              <li key={m.slug} className="border-b border-hairline py-3">
                <PersonName person={m} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("noMembers")}</p>
        )}
        {living > 0 && (
          <p className="text-caption text-ink-muted">
            {t("living", { count: living })}
          </p>
        )}
      </section>
    </main>
  );
}
