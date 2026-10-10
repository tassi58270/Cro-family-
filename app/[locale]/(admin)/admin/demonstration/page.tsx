import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DemoControls } from "@/components/admin/demo-controls";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { withViewer } from "@/lib/db";
import { demoLoaded } from "@/lib/demo/load";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/demonstration">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.demo" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function DemoPage({
  params,
}: PageProps<"/[locale]/admin/demonstration">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.demo" });
  const loaded = await withViewer(viewerOf(session), demoLoaded);

  return (
    <div className="grid max-w-2xl gap-8">
      <header className="grid gap-3">
        <h1 className="font-display text-title-lg">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("intro")}</p>
      </header>
      <ul className="grid gap-2 text-ink-muted">
        {(["people", "living", "content", "removal"] as const).map((key) => (
          <li key={key} className="flex gap-3">
            <span aria-hidden="true">·</span>
            {t(`points.${key}`)}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-6">
        <p className="font-medium" role="status">
          {loaded ? t("loaded") : t("notLoaded")}
        </p>
        <DemoControls loaded={loaded} />
      </div>
    </div>
  );
}
