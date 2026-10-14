"use client";

import { useTranslations } from "next-intl";
import {
  answerRequest,
  cancelInvitation,
  changeAccount,
  invite,
  type InviteState,
} from "@/app/[locale]/(admin)/admin/membres/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import type {
  AccessRequest,
  Invitation,
  Member,
} from "@/lib/data/admin-members";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { routing } from "@/lib/i18n/routing";
import { useRouter } from "@/lib/i18n/navigation";
import { AdminSection } from "./admin-kit";

const initial: InviteState = { status: "idle" };

/** A small form with one button, then the page is read again. */
function Act({
  action,
  fields,
  label,
  strong,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  strong?: boolean;
}) {
  const router = useRouter();
  return (
    <form
      action={async (form) => {
        await action(form);
        router.refresh();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        className={
          strong
            ? "link min-h-11 text-caption font-medium"
            : "link min-h-11 text-caption text-ink-muted"
        }
      >
        {label}
      </button>
    </form>
  );
}

function InviteForm({ locale }: { locale: string }) {
  const t = useTranslations("admin.members");
  const tLang = useTranslations("common.languages");
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(
    async (previous: InviteState, form: FormData) => {
      const next = await invite(previous, form);
      if (next.status === "sent") router.refresh();
      return next;
    },
    initial,
  );
  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label={t("inviteName")} name="name" autoComplete="off" />
        <TextField
          label={t("inviteEmail")}
          name="email"
          type="email"
          autoComplete="off"
          error={state.status === "invalid" ? t("errors.email") : undefined}
        />
        <SelectField label={t("inviteRole")} name="role" defaultValue="member">
          <option value="member">{t("roles.member")}</option>
          <option value="admin">{t("roles.admin")}</option>
        </SelectField>
        <SelectField
          label={t("inviteLanguage")}
          name="language"
          defaultValue={locale}
        >
          {routing.locales.map((l) => (
            <option key={l} value={l}>
              {tLang(l)}
            </option>
          ))}
        </SelectField>
      </div>
      <TextArea label={t("inviteMessage")} name="message" rows={3} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={pending}>
          {t("inviteSubmit")}
        </Button>
        {state.status === "sent" && (
          <p role="status" className="text-caption text-ink-muted">
            {t("invited", { email: state.email ?? "" })}
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-caption font-medium text-croy-text">
            {t("errors.error")}
          </p>
        )}
      </div>
      {state.devLink && (
        <p className="grid gap-2 border border-dashed border-hairline-strong p-4 text-caption">
          <span className="text-ink-muted">{t("devLink")}</span>
          <a className="link font-medium break-all" href={state.devLink}>
            {state.devLink}
          </a>
        </p>
      )}
    </form>
  );
}

export function MembersAdmin({
  requests,
  invitations,
  members,
  me,
  locale,
}: {
  requests: AccessRequest[];
  invitations: Invitation[];
  members: Member[];
  me: string;
  locale: string;
}) {
  const t = useTranslations("admin.members");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="grid gap-12">
      <header className="grid gap-2">
        <h1 className="font-display text-title">{t("title")}</h1>
        <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
      </header>

      <AdminSection
        id="demandes"
        title={t("requests")}
        intro={t("requestsIntro")}
        action={null}
      >
        {requests.length ? (
          <ul className="grid border-t border-hairline">
            {requests.map((r) => (
              <li
                key={r.id}
                className="grid gap-1 border-b border-hairline py-4"
              >
                <p className="font-medium">
                  {r.name}{" "}
                  <span className="font-normal text-ink-muted">{r.email}</span>
                </p>
                <p>{r.relation}</p>
                {r.message && (
                  <p className="whitespace-pre-line text-ink-muted">
                    {r.message}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4">
                  <Act
                    action={answerRequest}
                    fields={{ id: r.id, decision: "approve" }}
                    label={t("approve")}
                    strong
                  />
                  <Act
                    action={answerRequest}
                    fields={{ id: r.id, decision: "reject" }}
                    label={t("reject")}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("noRequests")}</p>
        )}
      </AdminSection>

      <AdminSection
        id="inviter"
        title={t("invite")}
        intro={t("inviteIntro")}
        action={null}
      >
        <InviteForm locale={locale} />
        <div className="grid gap-3">
          <h3 className="font-medium">{t("pending")}</h3>
          {invitations.length ? (
            <ul className="grid border-t border-hairline">
              {invitations.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">
                      {i.name ?? i.email}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {[
                        i.name ? i.email : null,
                        t(`roles.${i.role}`),
                        t("invitedOn", {
                          date: date.format(new Date(i.createdAt)),
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <Act
                    action={cancelInvitation}
                    fields={{ id: i.id }}
                    label={t("cancel")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("noPending")}</p>
          )}
        </div>
      </AdminSection>

      <AdminSection id="comptes" title={t("members")} intro="" action={null}>
        <ul className="grid border-t border-hairline">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
            >
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium">
                  {m.name || m.email}
                  {m.id === me && (
                    <span className="font-normal text-ink-muted">
                      {" "}
                      ({t("you")})
                    </span>
                  )}
                </span>
                <span className="text-caption text-ink-muted">
                  {[
                    m.name ? m.email : null,
                    m.person ? t("person", { name: m.person }) : null,
                    m.lastLogin
                      ? t("lastLogin", {
                          date: date.format(new Date(m.lastLogin)),
                        })
                      : t("never"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <StatusChip status={m.role === "admin" ? "published" : "draft"}>
                {t(`roles.${m.role}`)}
              </StatusChip>
              {m.disabled && (
                <StatusChip status="rejected">{t("disabled")}</StatusChip>
              )}
              {m.id !== me && (
                <>
                  <Act
                    action={changeAccount}
                    fields={{
                      id: m.id,
                      change: m.role === "admin" ? "member" : "admin",
                    }}
                    label={
                      m.role === "admin" ? t("makeMember") : t("makeAdmin")
                    }
                  />
                  <Act
                    action={changeAccount}
                    fields={{
                      id: m.id,
                      change: m.disabled ? "enable" : "disable",
                    }}
                    label={m.disabled ? t("enable") : t("disable")}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </AdminSection>
    </div>
  );
}
