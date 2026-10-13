import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PhotoUploader } from "@/components/photos/photo-uploader";
import { StatusChip, type ContentStatus } from "@/components/ui/chip";
import { requireMember, viewerOf } from "@/lib/auth/session";
import { albumChoices, myPhotos, placeChoices } from "@/lib/data/story-editor";
import { withViewer } from "@/lib/db";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/photos">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "photos.upload" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** A member sends photos and follows them until they are published. */
export default async function MyPhotosPage({
  params,
}: PageProps<"/[locale]/compte/photos">) {
  const locale = await resolveLocale(params);
  const session = await requireMember(locale);
  const t = await getTranslations({ locale, namespace: "photos.upload" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const { places, albums, mine } = await withViewer(
    viewerOf(session),
    async (q) => ({
      places: await placeChoices(q, locale),
      albums: await albumChoices(q, locale),
      mine: await myPhotos(q, session.accountId),
    }),
  );
  return (
    <main
      id="contenu"
      className="page mx-auto grid w-full max-w-5xl content-start gap-12 py-12 md:py-20"
    >
      <nav className="text-caption">
        <Link
          href="/compte"
          className="link inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <span aria-hidden="true">←</span>
          {t("account")}
        </Link>
      </nav>
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
      </header>
      <PhotoUploader
        locale={locale}
        places={places}
        albums={albums}
        admin={session.role === "admin"}
      />
      {mine.length > 0 && (
        <section
          aria-labelledby="mes-photos"
          className="grid gap-5 border-t border-hairline pt-10"
        >
          <h2 id="mes-photos" className="font-display text-title-sm">
            {t("mine")}
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {mine.map((p) => (
              <li key={p.id} className="grid gap-2">
                <Link
                  href={{
                    pathname: "/photos/[photo]",
                    params: { photo: p.id },
                  }}
                  className="block aspect-square overflow-hidden rounded-xs bg-paper-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- sized by /fichiers. */}
                  <img
                    src={`/fichiers/${p.path}?l=320`}
                    alt={p.caption ?? ""}
                    className="size-full object-cover"
                  />
                </Link>
                <StatusChip status={p.status as ContentStatus}>
                  {tStatus(p.status as ContentStatus)}
                </StatusChip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
