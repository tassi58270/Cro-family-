import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FamilyEditor } from "@/components/admin/family-editor";
import { requireAdmin, viewerOf } from "@/lib/auth/session";
import { countPeople, defaultFocusId, familyFocus } from "@/lib/data/family";
import { withViewer } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/arbre">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "admin.tree" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function FamilyEditorPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/arbre">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const { personne } = await searchParams;
  const requested =
    typeof personne === "string" && UUID.test(personne) ? personne : null;

  const { focus, total } = await withViewer(viewerOf(session), async (q) => {
    const id = requested ?? (await defaultFocusId(q));
    return {
      focus: id ? await familyFocus(q, id) : null,
      total: await countPeople(q),
    };
  });

  return <FamilyEditor focus={focus} total={total} />;
}
