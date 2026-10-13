import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlbumView } from "@/components/photos/album-view";
import { albumSlugs, loadPhotoIndex } from "@/lib/data/photos";
import { VISITOR } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateStaticParams() {
  return (await albumSlugs()).map((album) => ({ album }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/photos/albums/[album]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { album } = await params;
  const index = await loadPhotoIndex(VISITOR, locale);
  const found = index.albums.find((a) => a.slug === album);
  return found
    ? { title: found.title, description: found.description ?? undefined }
    : {};
}

/** An album, and its slideshow (6.5). */
export default async function AlbumPage({
  params,
}: PageProps<"/[locale]/photos/albums/[album]">) {
  const locale = await resolveLocale(params);
  const { album } = await params;
  const index = await loadPhotoIndex(VISITOR, locale);
  const found = index.albums.find((a) => a.slug === album);
  if (!found && !(await albumSlugs()).includes(album)) notFound();
  const t = await getTranslations({ locale, namespace: "photos" });
  return (
    <main id="contenu" className="grid gap-8 pt-8 pb-28 md:pt-12">
      <div className="grid max-w-4xl gap-4 px-(--gutter)">
        <nav className="text-caption">
          <Link
            href={{ pathname: "/photos", query: { vue: "albums" } }}
            className="link inline-flex min-h-11 items-center gap-2 font-medium"
          >
            <span aria-hidden="true">←</span>
            {t("title")}
          </Link>
        </nav>
        <h1 className="font-display text-title-lg">{found?.title ?? album}</h1>
        {found?.description && (
          <p className="max-w-2xl text-lead text-ink-muted">
            {found.description}
          </p>
        )}
      </div>
      <AlbumView
        slug={album}
        initial={index.photos.filter((p) => p.album?.slug === album)}
        locale={locale}
      />
    </main>
  );
}
