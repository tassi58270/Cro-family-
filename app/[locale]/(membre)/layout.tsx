import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { requireMember } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/server";

/** Member area: signed-in accounts only, never cached. */
export default async function MemberLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  await requireMember(locale);

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col pt-(--header-h)">{children}</div>
      <SiteFooter locale={locale} />
    </>
  );
}
