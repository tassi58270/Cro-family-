import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/[locale]/(public)/connexion/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Brand } from "@/components/ui/site-header";
import { DemoBanner } from "@/components/ui/demo-banner";
import { requireAdmin } from "@/lib/auth/session";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocale } from "@/lib/i18n/server";

/**
 * Dashboard (cahier des charges, section 7): administrators only, rendered
 * on demand, never cached, usable on a phone.
 */
export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const locale = await resolveLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <>
      <header className="page sticky top-0 z-40 flex h-(--header-h) items-center gap-3 border-b border-hairline bg-paper print:hidden">
        <Brand />
        <span className="hidden text-caption text-ink-muted sm:inline">
          {t("title")}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center px-3 text-caption font-medium hover:underline"
          >
            {t("viewSite")}
          </Link>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              title={session.email}
              className="inline-flex min-h-11 items-center px-3 text-caption font-medium text-ink-muted hover:text-ink"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>
      <div className="print:hidden">
        <DemoBanner />
      </div>
      <div className="page mx-auto grid w-full max-w-7xl flex-1 gap-6 pt-6 pb-24 lg:grid-cols-[13rem_1fr] lg:gap-12 lg:pt-10">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
