import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MembersAdmin } from "@/components/admin/members-admin";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadMembers } from "@/lib/data/admin-members";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/membres">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.members" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Invitations, access requests and accounts (sections 4 and 7). */
export default async function MembersPage({
  params,
}: PageProps<"/[locale]/admin/membres">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const data = await withViewer(viewerOf(session), loadMembers);
  return <MembersAdmin {...data} me={session.accountId} locale={locale} />;
}
