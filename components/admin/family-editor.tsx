"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deletePerson } from "@/app/[locale]/(admin)/admin/arbre/actions";
import { Button } from "@/components/ui/button";
import { initials } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SidePanel } from "@/components/ui/side-panel";
import type { FamilyFocus, PersonSummary } from "@/lib/data/family";
import { cn } from "@/lib/design/cn";
import { formatFuzzyDate } from "@/lib/genealogie/dates";
import { lifespan, lifespanYears, personName } from "@/lib/genealogie/names";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { PersonForm, type FormContext } from "./person-form";

type Panel = { title: string; context: FormContext } | null;

function focusHref(id: string) {
  return { pathname: "/admin/arbre" as const, query: { personne: id } };
}

/** A relative: one tap brings them to the centre. */
function PersonTile({
  person,
  note,
}: {
  person: PersonSummary;
  note?: string;
}) {
  const t = useTranslations("admin.tree");
  const name = personName(person) || t("unnamed");
  return (
    <Link
      href={focusHref(person.id)}
      className="group flex min-h-16 items-center gap-3 border border-hairline bg-paper px-3 py-2.5 transition-[border-color,transform] duration-(--duration-fast) hover:border-ink active:scale-[0.98]"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-2 font-display text-[0.9375rem]"
      >
        {initials(name)}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate font-medium">{name}</span>
        <span className="tabular truncate text-caption text-ink-muted">
          {[note, lifespanYears(person)].filter(Boolean).join(" · ") || " "}
        </span>
      </span>
      {person.status !== "published" && (
        <span className="ml-auto shrink-0 text-caption text-ink-muted">
          {t("draft")}
        </span>
      )}
    </Link>
  );
}

function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 items-center gap-3 border border-dashed border-hairline-strong px-3 py-2.5 text-left font-medium transition-[border-color,background-color,transform] duration-(--duration-fast) hover:border-croy hover:bg-paper-2 active:scale-[0.98]"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full border border-croy text-[1.25rem] leading-none text-croy-text"
      >
        +
      </span>
      {label}
    </button>
  );
}

function Group({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3", className)}>
      <h2 className="text-caption font-medium text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Direct entry in the tree (cahier des charges, section 7): one person in the
 * centre, their parents above, partners and children below, and a « + » on
 * each side to add someone without leaving the screen.
 */
export function FamilyEditor({
  focus,
  total,
}: {
  focus: FamilyFocus | null;
  total: number;
}) {
  const t = useTranslations("admin.tree");
  const locale = useLocale();
  const router = useRouter();
  const [panel, setPanelState] = useState<Panel>(null);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const [deleting, startDelete] = useTransition();

  // The content stays while the panel slides out; a new opening starts afresh.
  const setPanel = (next: Panel) => {
    if (next) {
      setPanelState(next);
      setOpened((n) => n + 1);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const closeAndRefresh = (personId: string) => {
    const wasFirst =
      panel?.context.relation === "none" && !panel.context.person;
    setOpen(false);
    if (wasFirst) router.push(focusHref(personId));
    else router.refresh();
  };

  const formPanel = (
    <FormPanel
      panel={panel}
      open={open}
      formKey={opened}
      onClose={() => setOpen(false)}
      onSaved={closeAndRefresh}
    />
  );

  // The panel keeps its place whatever is shown, so that the form that has
  // just saved stays mounted long enough to close it.
  if (!focus) {
    return (
      <>
        <div className="grid gap-8">
          <header className="grid gap-3">
            <h1 className="font-display text-title-lg">{t("title")}</h1>
          </header>
          <div className="border border-hairline">
            <EmptyState
              title={t("emptyTitle")}
              body={<p>{t("emptyBody")}</p>}
              action={
                <Button
                  onClick={() =>
                    setPanel({
                      title: t("addFirst"),
                      context: { relation: "none" },
                    })
                  }
                >
                  {t("addFirst")}
                </Button>
              }
            />
          </div>
        </div>
        {formPanel}
      </>
    );
  }

  const { person, parents, unions, children, siblings } = focus;
  const name = personName(person) || t("unnamed");
  const span = lifespan(person, locale);
  const unionLabel = (partner: PersonSummary | null) =>
    partner
      ? t("withPartner", { name: personName(partner) })
      : t("unknownPartner");

  const childrenOf = (unionId: string | null) =>
    children.filter((c) => (c.union_id ?? null) === unionId);
  const loneChildren = children.filter(
    (c) => !c.union_id || !unions.some((u) => u.id === c.union_id),
  );

  const addChild = (unionId?: string) =>
    setPanel({
      title: t("addChildOf", { name }),
      context: {
        relation: "child",
        relativeId: person.id,
        unions: [
          ...unions
            .filter((u) => !unionId || u.id === unionId)
            .map((u) => ({ id: u.id, label: unionLabel(u.partner) })),
          ...unions
            .filter((u) => unionId && u.id !== unionId)
            .map((u) => ({ id: u.id, label: unionLabel(u.partner) })),
        ],
      },
    });

  return (
    <>
      <div className="grid gap-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <h1 className="font-display text-title-lg">{t("title")}</h1>
            <p className="tabular text-caption text-ink-muted">
              {t("count", { count: total })}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setPanel({ title: t("addFirst"), context: { relation: "none" } })
            }
          >
            {t("addUnlinked")}
          </Button>
        </header>

        <Group title={t("parents")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {parents.map((p) => (
              <PersonTile key={p.id} person={p} />
            ))}
            {parents.length < 2 && (
              <AddTile
                label={t("addParent")}
                onClick={() =>
                  setPanel({
                    title: t("addParentOf", { name }),
                    context: {
                      relation: "parent",
                      relativeId: person.id,
                      deceasedByDefault: true,
                    },
                  })
                }
              />
            )}
          </div>
        </Group>

        <article
          aria-labelledby="focus-name"
          className="relative grid gap-5 border-l-4 border-croy bg-paper-2 p-6 md:p-8"
        >
          <div className="grid gap-2">
            <p className="text-caption font-medium text-ink-muted">
              {t("focusLabel")}
              {person.is_demo && ` · ${t("demo")}`}
              {person.status !== "published" && ` · ${t("draft")}`}
            </p>
            <h2 id="focus-name" className="font-display text-title">
              {name}
            </h2>
            {span && <p className="tabular text-lead">{span}</p>}
            {(person.birth_place || person.death_place) && (
              <p className="text-ink-muted">
                {[person.birth_place, person.death_place]
                  .filter(Boolean)
                  .join(" → ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPanel({
                  title: t("edit", { name }),
                  context: { relation: "none", person },
                })
              }
            >
              {t("editButton")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              busy={deleting}
              onClick={() => {
                if (!window.confirm(t("deleteConfirm", { name }))) return;
                startDelete(async () => {
                  const form = new FormData();
                  form.set("id", person.id);
                  await deletePerson(form);
                  const next = parents[0] ?? unions[0]?.partner ?? children[0];
                  router.push(
                    next ? focusHref(next.id) : { pathname: "/admin/arbre" },
                  );
                  router.refresh();
                });
              }}
            >
              {t("delete")}
            </Button>
          </div>
        </article>

        <Group title={t("partners")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {unions.map((u) =>
              u.partner ? (
                <PersonTile
                  key={u.id}
                  person={u.partner}
                  note={
                    u.marriage_date && u.marriage_precision
                      ? t("married", {
                          date: formatFuzzyDate(
                            {
                              date: u.marriage_date,
                              precision: u.marriage_precision,
                            },
                            locale,
                          ),
                        })
                      : undefined
                  }
                />
              ) : null,
            )}
            <AddTile
              label={t("addPartner")}
              onClick={() =>
                setPanel({
                  title: t("addPartnerOf", { name }),
                  context: {
                    relation: "partner",
                    relativeId: person.id,
                    deceasedByDefault: person.deceased,
                  },
                })
              }
            />
          </div>
        </Group>

        {unions.map((u) => (
          <Group
            key={u.id}
            title={t("childrenWith", {
              name: u.partner ? personName(u.partner) : "?",
            })}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {childrenOf(u.id).map((c) => (
                <PersonTile key={c.id} person={c} />
              ))}
              <AddTile label={t("addChild")} onClick={() => addChild(u.id)} />
            </div>
          </Group>
        ))}

        {(unions.length === 0 || loneChildren.length > 0) && (
          <Group title={unions.length ? t("otherChildren") : t("children")}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {loneChildren.map((c) => (
                <PersonTile key={c.id} person={c} />
              ))}
              {unions.length === 0 && (
                <AddTile label={t("addChild")} onClick={() => addChild()} />
              )}
            </div>
          </Group>
        )}

        {siblings.length > 0 && (
          <Group title={t("siblings")}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {siblings.map((s) => (
                <PersonTile key={s.id} person={s} />
              ))}
            </div>
          </Group>
        )}
      </div>
      {formPanel}
    </>
  );
}

function FormPanel({
  panel,
  open,
  formKey,
  onClose,
  onSaved,
}: {
  panel: Panel;
  open: boolean;
  formKey: number;
  onClose: () => void;
  onSaved: (personId: string) => void;
}) {
  return (
    <SidePanel open={open} onClose={onClose} title={panel?.title ?? ""}>
      {panel && (
        // A new form for every opening, so that fields start empty.
        <PersonForm key={formKey} context={panel.context} onSaved={onSaved} />
      )}
    </SidePanel>
  );
}
