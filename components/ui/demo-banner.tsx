import { getTranslations } from "next-intl/server";
import { hasDatabase, VISITOR, withViewer } from "@/lib/db";
import { Tremas } from "./bands";

/**
 * While the fictional « Exemple » family is loaded, every page says so
 * (cahier des charges, step 4), so that nobody takes it for real.
 */
export async function DemoBanner() {
  if (!hasDatabase()) return null;
  const [{ demo }] = await withViewer(VISITOR, (q) =>
    q<{ demo: boolean }>(
      `select exists (select 1 from public.people where is_demo)
           or exists (select 1 from public.places where is_demo) as demo`,
    ),
  ).catch(() => [{ demo: false }]);
  if (!demo) return null;
  const t = await getTranslations("demo");

  return (
    <div
      role="note"
      data-intro-hide
      className="page flex items-center gap-3 border-b border-croy/30 bg-paper-2 py-2.5 text-caption"
    >
      <Tremas className="text-[0.75rem]" />
      <p>
        <strong className="font-medium">{t("bannerTitle")}</strong>{" "}
        <span className="text-ink-muted">{t("bannerBody")}</span>
      </p>
    </div>
  );
}
