"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";
import { Link, usePathname } from "@/lib/i18n/navigation";

export const adminNav = [
  { href: "/admin", key: "overview" },
  { href: "/admin/accueil", key: "home" },
  { href: "/admin/arbre", key: "tree" },
  { href: "/admin/lignees", key: "lineages" },
  { href: "/admin/import", key: "import" },
  { href: "/admin/demonstration", key: "demo" },
] as const;

/** Dashboard sections: a scrollable row on phones, a column on computers. */
export function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="min-w-0 lg:sticky lg:top-(--header-h) lg:self-start"
    >
      <ul className="-mx-(--gutter) flex gap-1 overflow-x-auto px-(--gutter) pb-2 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0">
        {adminNav.map((item) => {
          const current =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xs px-3 text-caption font-medium whitespace-nowrap transition-colors duration-(--duration-fast)",
                  current ? "bg-ink text-paper" : "hover:bg-paper-2",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
