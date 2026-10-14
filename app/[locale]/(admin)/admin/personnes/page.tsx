import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PeopleAdmin } from "@/components/admin/people-admin";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadPeopleAdmin } from "@/lib/data/admin-people";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/personnes">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.people" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Everyone in the tree, what each sheet lacks, and duplicates to merge. */
export default async function PeoplePage({
  params,
}: PageProps<"/[locale]/admin/personnes">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const data = await withViewer(viewerOf(session), loadPeopleAdmin);
  return <PeopleAdmin {...data} />;
}
