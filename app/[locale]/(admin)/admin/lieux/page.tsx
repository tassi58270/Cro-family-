import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlacesEditor } from "@/components/admin/places-editor";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { loadAdminPlaces } from "@/lib/data/admin-places";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/lieux">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.places" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Places and events, as shown on the map and the timeline. */
export default async function PlacesEditorPage({
  params,
}: PageProps<"/[locale]/admin/lieux">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const { places, events, branches } = await withViewer(
    viewerOf(session),
    loadAdminPlaces,
  );
  return (
    <PlacesEditor
      places={places}
      events={events}
      branches={branches}
      locale={locale}
    />
  );
}
