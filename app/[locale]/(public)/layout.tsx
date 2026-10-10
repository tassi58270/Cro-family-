import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { resolveLocale } from "@/lib/i18n/server";

/** Public pages: fixed menu at the top, invitation and credits at the bottom. */
export default async function PublicLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col pt-(--header-h)">{children}</div>
      <SiteFooter locale={locale} />
    </>
  );
}
