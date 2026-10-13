import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PhotosAdmin } from "@/components/admin/photos-admin";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { photoQueue } from "@/lib/data/admin-photos";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/photos">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.photos" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Photos to publish, names proposed, removal requests and albums. */
export default async function AdminPhotosPage({
  params,
}: PageProps<"/[locale]/admin/photos">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const queue = await withViewer(viewerOf(session), photoQueue);
  return <PhotosAdmin {...queue} />;
}
