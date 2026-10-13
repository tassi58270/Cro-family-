"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Shield,
  builtInArms,
  type BuiltInArms,
} from "@/components/heraldique/shield";
import { Tremas } from "@/components/ui/bands";
import { initials } from "@/components/ui/chip";
import type {
  Certainty,
  PersonDetail,
  Relative,
  Source,
} from "@/lib/data/person";
import { cn } from "@/lib/design/cn";
import { formatFuzzyDate, type FuzzyDate } from "@/lib/genealogie/dates";
import { Link } from "@/lib/i18n/navigation";

/**
 * The page of a person (cahier des charges, 6.2): portrait and arms, dates
 * and places, titles, roles, works, biography, marriages with their
 * children, parents, brothers and sisters, linked stories, places and
 * events — and, on its own tab, the proofs. Used in the side panel of the
 * tree and as a full page.
 */

type Props = {
  person: PersonDetail;
  /** In the tree, relatives open there instead of their own page. */
  onSelect?: (relative: Relative) => void;
  headingLevel?: "h1" | "h2";
  /** False inside a panel whose title is already the name. */
  showName?: boolean;
  signedIn?: boolean;
};

export function CertaintyMark({
  certainty,
}: {
  certainty: Certainty | undefined;
}) {
  const t = useTranslations("tree.certainty");
  if (!certainty || certainty === "attested") return null;
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded-full border px-2 text-[0.75rem] leading-6 font-medium",
        certainty === "debated"
          ? "border-croy text-croy-text"
          : "border-hairline-strong text-ink-muted",
      )}
      title={t(`${certainty}Hint`)}
    >
      {t(certainty)}
    </span>
  );
}

function RelativeItem({
  relative,
  onSelect,
}: {
  relative: Relative;
  onSelect?: Props["onSelect"];
}) {
  const t = useTranslations("tree");
  if (relative.hidden || !relative.slug) {
    return (
      <span className="inline-flex min-h-11 items-center gap-2.5 text-ink-muted">
        <span
          aria-hidden="true"
          className="size-8 shrink-0 rounded-full border border-dashed border-hairline-strong"
        />
        {t("living")}
      </span>
    );
  }
  const content = (
    <>
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 font-display text-[0.8125rem]"
      >
        {initials(relative.name ?? "")}
      </span>
      <span className="grid text-left">
        <span className="font-medium underline decoration-transparent decoration-[1.5px] underline-offset-4 transition-colors group-hover:decoration-croy">
          {relative.name}
        </span>
        {relative.years && (
          <span className="tabular text-caption text-ink-muted">
            {relative.years}
          </span>
        )}
      </span>
    </>
  );
  return (
    <span className="inline-flex items-center">
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(relative)}
          className="group inline-flex min-h-11 items-center gap-2.5"
        >
          {content}
        </button>
      ) : (
        <Link
          href={{
            pathname: "/arbre/[personne]",
            params: { personne: relative.slug },
          }}
          className="group inline-flex min-h-11 items-center gap-2.5"
        >
          {content}
        </Link>
      )}
      <CertaintyMark certainty={relative.certainty} />
    </span>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-hairline pt-5">
      <h3 className="text-caption font-medium text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function Relatives({
  list,
  onSelect,
}: {
  list: Relative[];
  onSelect?: Props["onSelect"];
}) {
  return (
    <ul className="grid gap-1">
      {list.map((r) => (
        <li key={r.id}>
          <RelativeItem relative={r} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

export function SourceItem({ source }: { source: Source }) {
  const t = useTranslations("tree.proofs");
  return (
    <li className="grid gap-2 border-l-2 border-croy pl-4">
      <p className="font-medium">{source.title}</p>
      <p className="text-caption text-ink-muted">
        {[
          t(`kinds.${source.kind as "document"}`),
          source.reference,
          source.repository,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {source.url && (
        <a
          href={source.url}
          className="link text-caption"
          rel="noreferrer"
          target="_blank"
        >
          {t("open")}
        </a>
      )}
      {source.transcription && (
        <details className="group">
          <summary className="cursor-pointer text-caption font-medium">
            {t("transcription")}
          </summary>
          <blockquote className="mt-2 border-l border-hairline pl-3 font-display text-[1.0625rem] leading-relaxed whitespace-pre-line">
            {source.transcription}
          </blockquote>
        </details>
      )}
      {source.translation && (
        <details>
          <summary className="cursor-pointer text-caption font-medium">
            {t("translation")}
          </summary>
          <p className="mt-2 whitespace-pre-line">{source.translation}</p>
        </details>
      )}
      {source.note && (
        <p className="text-caption text-ink-muted">{source.note}</p>
      )}
    </li>
  );
}

export function PersonSheet({
  person,
  onSelect,
  headingLevel: Heading = "h1",
  showName = true,
  signedIn,
}: Props) {
  const t = useTranslations("tree");
  const locale = useLocale();
  const [tab, setTab] = useState<"sheet" | "proofs">("sheet");
  const date = (d: FuzzyDate) => formatFuzzyDate(d, locale);
  const proofCount =
    person.sources.length +
    Object.values(person.filiationSources).reduce((n, s) => n + s.length, 0);
  const arms =
    person.arms?.builtin &&
    (builtInArms as readonly string[]).includes(person.arms.builtin)
      ? (person.arms.builtin as BuiltInArms)
      : undefined;
  const bio = person.biography?.text ?? "";
  const longBio = bio.length > 700;

  return (
    <article className="grid gap-6">
      <header className="flex items-start gap-5">
        <Shield
          arms={arms}
          label={person.arms?.name ?? t("noArms")}
          decorative={!person.arms}
          className="mt-1 w-12 shrink-0 md:w-14"
        />
        <div className="grid min-w-0 gap-2">
          {person.branch && showName && (
            <p className="flex items-center gap-2 text-caption font-medium text-ink-muted">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{
                  background: person.branch.color ?? "var(--hairline-strong)",
                }}
              />
              {person.branch.name}
            </p>
          )}
          {showName && (
            <Heading className="font-display text-title">{person.name}</Heading>
          )}
          <p className="grid gap-0.5 text-ink-muted">
            {person.birth && (
              <span>
                {t("born", {
                  sex: person.sex,
                  precision: person.birth.precision,
                  date: date(person.birth),
                })}
                {person.birth.place &&
                  ` ${t("at", { place: person.birth.place })}`}
              </span>
            )}
            {person.death && (
              <span>
                {t("died", {
                  sex: person.sex,
                  precision: person.death.precision,
                  date: date(person.death),
                })}
                {person.death.place &&
                  ` ${t("at", { place: person.death.place })}`}
              </span>
            )}
            {!person.death && person.deceased && (
              <span>{t("deceased", { sex: person.sex })}</span>
            )}
          </p>
          <p className="flex flex-wrap gap-2">
            {person.living && (
              <span className="rounded-full bg-paper-2 px-2.5 text-caption leading-7">
                {t("livingBadge", { sex: person.sex })}
              </span>
            )}
            {person.status !== "published" && (
              <span className="rounded-full border border-hairline-strong px-2.5 text-caption leading-7">
                {t("draft")}
              </span>
            )}
            {person.isDemo && (
              <span className="rounded-full border border-croy px-2.5 text-caption leading-7 text-croy-text">
                {t("demoBadge")}
              </span>
            )}
          </p>
        </div>
      </header>

      {proofCount > 0 && (
        <div
          role="tablist"
          aria-label={t("tabs")}
          className="flex gap-1 border-b border-hairline"
        >
          {(["sheet", "proofs"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px min-h-11 border-b-2 px-3 text-caption font-medium",
                tab === key
                  ? "border-croy text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {key === "sheet"
                ? t("tabSheet")
                : t("tabProofs", { count: proofCount })}
            </button>
          ))}
        </div>
      )}

      {tab === "proofs" ? (
        <div className="grid gap-6" role="tabpanel">
          <p className="text-caption text-ink-muted">{t("proofs.intro")}</p>
          {person.sources.length > 0 && (
            <Block title={t("proofs.aboutPerson")}>
              <ul className="grid gap-5">
                {person.sources.map((s) => (
                  <SourceItem key={s.id} source={s} />
                ))}
              </ul>
            </Block>
          )}
          {person.parents.map((parent) =>
            person.filiationSources[parent.id]?.length ? (
              <Block
                key={parent.id}
                title={t("proofs.filiation", {
                  name: parent.name ?? t("living"),
                })}
              >
                <p className="text-caption">
                  {t("proofs.certainty")}{" "}
                  <CertaintyMark certainty={parent.certainty} />
                  {parent.certainty === "attested" && t("certainty.attested")}
                </p>
                <ul className="grid gap-5">
                  {person.filiationSources[parent.id].map((s) => (
                    <SourceItem key={s.id} source={s} />
                  ))}
                </ul>
              </Block>
            ) : null,
          )}
        </div>
      ) : (
        <div
          className="grid gap-6"
          role={proofCount > 0 ? "tabpanel" : undefined}
        >
          {person.titles.length > 0 && (
            <Block title={t("titles")}>
              <ul className="grid gap-2">
                {person.titles.map((title, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium">{title.name}</span>
                    <span className="tabular text-caption text-ink-muted">
                      {[
                        title.rank && t("rank", { rank: title.rank }),
                        [title.from, title.to].filter(Boolean).join("–"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {person.roles && (
            <Block title={t("roles")}>
              <p className="whitespace-pre-line" lang={person.roles.lang}>
                {person.roles.text}
              </p>
            </Block>
          )}
          {person.works && (
            <Block title={t("works")}>
              <p className="whitespace-pre-line" lang={person.works.lang}>
                {person.works.text}
              </p>
            </Block>
          )}
          {person.biography && (
            <Block title={t("biography")}>
              {longBio ? (
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <p
                      className="whitespace-pre-line"
                      lang={person.biography.lang}
                    >
                      {bio.slice(0, 600).trimEnd()}…
                    </p>
                    <span className="link mt-2 inline-block font-medium group-open:hidden">
                      {t("readMore")}
                    </span>
                  </summary>
                  <p
                    className="whitespace-pre-line"
                    lang={person.biography.lang}
                  >
                    {bio.slice(600)}
                  </p>
                </details>
              ) : (
                <p className="whitespace-pre-line" lang={person.biography.lang}>
                  {bio}
                </p>
              )}
            </Block>
          )}

          {person.unions.map((u) => (
            <Block
              key={u.id}
              title={
                person.unions.length > 1
                  ? t("marriageNumber", { order: u.order })
                  : t("marriage")
              }
            >
              <div className="grid gap-2">
                {u.partner && (
                  <RelativeItem relative={u.partner} onSelect={onSelect} />
                )}
                <p className="text-caption text-ink-muted">
                  {[
                    u.marriage && formatFuzzyDate(u.marriage, locale),
                    u.marriage?.place,
                    u.partnerFamily && t("family", { name: u.partnerFamily }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  <CertaintyMark certainty={u.certainty} />
                </p>
                {u.children.length > 0 && (
                  <div className="mt-2 grid gap-1 border-l border-hairline pl-4">
                    <p className="text-caption text-ink-muted">
                      {t("childrenOfUnion")}
                    </p>
                    <Relatives list={u.children} onSelect={onSelect} />
                  </div>
                )}
              </div>
            </Block>
          ))}

          {person.parents.length > 0 && (
            <Block title={t("parents")}>
              <Relatives list={person.parents} onSelect={onSelect} />
            </Block>
          )}
          {person.siblings.length > 0 && (
            <Block title={t("siblings")}>
              <Relatives list={person.siblings} onSelect={onSelect} />
            </Block>
          )}
          {person.otherChildren.length > 0 && (
            <Block title={t("children")}>
              <Relatives list={person.otherChildren} onSelect={onSelect} />
            </Block>
          )}

          {person.stories.length > 0 && (
            <Block title={t("stories")}>
              <ul className="grid gap-3">
                {person.stories.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={{
                        pathname: "/histoires/[histoire]",
                        params: { histoire: s.slug },
                      }}
                      className="group grid gap-1"
                    >
                      <span className="flex items-center gap-2 font-medium group-hover:underline">
                        <Tremas className="text-[0.625rem]" />
                        {s.title}
                      </span>
                      {s.excerpt && (
                        <span className="line-clamp-2 text-caption text-ink-muted">
                          {s.excerpt}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {(person.places.length > 0 || person.events.length > 0) && (
            <Block title={t("placesAndEvents")}>
              <ul className="grid gap-2">
                {person.events.map((e) => (
                  <li key={e.slug} className="flex gap-3">
                    <span className="tabular w-12 shrink-0 font-display text-croy-text">
                      {e.year ?? "—"}
                    </span>
                    <span>
                      {e.title}
                      {e.place && (
                        <span className="text-caption text-ink-muted">
                          {" "}
                          · {e.place}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {person.places.map((p) => (
                  <li key={p.slug} className="flex gap-3">
                    <Tremas className="mt-2 text-[0.625rem]" />
                    <Link
                      href={{
                        pathname: "/lieux/[lieu]",
                        params: { lieu: p.slug },
                      }}
                      className="link"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {signedIn && (
            <p className="border-t border-hairline pt-5">
              <Link
                href={{
                  pathname: "/contribuer",
                  query: { personne: person.slug },
                }}
                className="link font-medium"
              >
                {t("suggest")}
              </Link>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
