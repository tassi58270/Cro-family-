import { useTranslations } from "next-intl";
import type { ArmsItem, BranchItem, PersonLink } from "@/lib/data/arms";
import { Link } from "@/lib/i18n/navigation";
import { ArmsImage } from "./arms-gallery";
import { branchColor } from "./branch-color";

/** Someone of a branch: a link to their page, or « Personne vivante ». */
export function PersonName({ person }: { person: PersonLink }) {
  const t = useTranslations("tree");
  if (!person.slug || !person.name)
    return <span className="text-ink-muted">{t("living")}</span>;
  return (
    <Link
      href={{
        pathname: "/arbre/[personne]",
        params: { personne: person.slug },
      }}
      className="link"
    >
      {person.name}
      {person.years && (
        <span className="tabular text-ink-muted"> ({person.years})</span>
      )}
    </Link>
  );
}

export function extinctionLine(
  t: ReturnType<typeof useTranslations<"armsPage.branches">>,
  b: BranchItem,
) {
  if (!b.extinct) return t("extant");
  if (b.extinctMale && b.extinctFemale && b.extinctMale !== b.extinctFemale) {
    return t("extinctBoth", { male: b.extinctMale, female: b.extinctFemale });
  }
  const year = b.extinctMale ?? b.extinctFemale;
  return year ? t("extinctIn", { year }) : t("extinct");
}

/**
 * One branch (6.3): founder, last representative, the years it died out
 * through the men and through the women, what became of its titles and
 * lands, and the way to its place in the tree.
 */
export function BranchCard({
  branch,
  index,
  arms,
  headingLevel: Heading = "h3",
}: {
  branch: BranchItem;
  index: number;
  arms: ArmsItem | undefined;
  headingLevel?: "h2" | "h3";
}) {
  const t = useTranslations("armsPage.branches");
  const color = branchColor(branch, index);
  const treeHref = branch.founder?.slug
    ? { pathname: "/arbre" as const, query: { depuis: branch.founder.slug } }
    : { pathname: "/arbre" as const, query: { vue: "branches" } };

  return (
    <article
      className="grid gap-4 border-t-[3px] pt-5"
      style={{ borderColor: color }}
    >
      <header className="flex items-start gap-4">
        {arms && <ArmsImage item={arms} className="w-11 shrink-0" />}
        <div className="grid min-w-0 gap-1">
          <Heading className="font-display text-title-sm">
            {branch.name}
          </Heading>
          <p className="tabular text-caption text-ink-muted">
            {[
              branch.start && t("since", { year: branch.start }),
              extinctionLine(t, branch),
              t("people", { count: branch.people }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>
      {branch.description && (
        <p className="max-w-prose">{branch.description}</p>
      )}
      {(branch.founder || branch.last) && (
        <dl className="grid gap-x-6 gap-y-1 text-caption sm:grid-cols-[auto_minmax(0,1fr)]">
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
        </dl>
      )}
      {branch.fate && (
        <div className="grid gap-1 border-l-2 border-hairline-strong pl-4">
          <p className="text-caption font-medium text-ink-muted">{t("fate")}</p>
          <p className="max-w-prose">{branch.fate}</p>
        </div>
      )}
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-caption font-medium">
        <Link
          href={treeHref}
          className="link inline-flex min-h-11 items-center"
        >
          {t("inTree")}
        </Link>
        <Link
          href={{
            pathname: "/branches/[branche]",
            params: { branche: branch.slug },
          }}
          className="link inline-flex min-h-11 items-center"
        >
          {t("details")}
        </Link>
      </p>
    </article>
  );
}
