"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

const isAdmin = () =>
  document.cookie.split("; ").some((c) => c === "croy_membre=admin");

/**
 * « Modifier sur place » (section 7): signed in as an administrator, each
 * public page offers the form that changes it. The page itself is the same
 * for everyone; only the browser knows who reads it.
 */
export function EditLink({
  href,
}: {
  href: ComponentProps<typeof Link>["href"];
}) {
  const t = useTranslations("common");
  const admin = useSyncExternalStore(
    () => () => {},
    isAdmin,
    () => false,
  );
  if (!admin) return null;
  return (
    <Link
      href={href}
      className="fixed right-4 bottom-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-caption font-medium text-paper shadow-[0_6px_24px_rgb(0_0_0/0.18)] transition-transform duration-(--duration-fast) ease-out active:scale-[0.97] md:right-6 md:bottom-6"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.5 2.5l3 3-8 8H2.5v-3z" />
      </svg>
      {t("edit")}
    </Link>
  );
}
