import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PhotoEditor } from "@/components/admin/photo-editor";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { editablePhoto, eventChoices } from "@/lib/data/admin-photos";
import { albumChoices, placeChoices } from "@/lib/data/story-editor";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/photos/[photo]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.photos" });
  return { title: t("editTitle"), robots: { index: false, follow: false } };
}

export default async function AdminPhotoPage({
  params,
}: PageProps<"/[locale]/admin/photos/[photo]">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const { photo: id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.photos" });
  const data = await withViewer(viewerOf(session), async (q) => ({
    photo: await editablePhoto(q, id),
    places: await placeChoices(q, locale),
    events: await eventChoices(q, locale),
    albums: await albumChoices(q, locale),
  }));
  if (!data.photo) notFound();
  return (
    <div className="grid gap-8">
      <nav className="text-caption">
        <Link
          href="/admin/photos"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("title")}
        </Link>
      </nav>
      <h1 className="font-display text-title">{t("editTitle")}</h1>
      <PhotoEditor
        photo={data.photo}
        places={data.places}
        events={data.events}
        albums={data.albums}
        locale={locale}
      />
    </div>
  );
}
