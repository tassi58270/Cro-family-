"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Shield } from "@/components/heraldique/shield";
import { cn } from "@/lib/design/cn";
import { mainNav } from "@/lib/i18n/main-nav";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { Tremas } from "./bands";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Brand({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 font-display text-[1.625rem] leading-none",
        className,
      )}
    >
      <Shield arms="croy" decorative className="w-[1.05rem]" />
      <span>Croÿ</span>
      <span className="sr-only">{t("homeLabel")}</span>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
      <circle
        cx="8.5"
        cy="8.5"
        r="5.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m13 13 4.25 4.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const iconButton =
  "grid size-11 place-items-center rounded-full transition-[background-color,transform] duration-(--duration-fast) hover:bg-paper-2 active:scale-[0.94]";

/**
 * Fixed, discreet header. It slides away while reading down the page and
 * comes back as soon as the visitor scrolls up. Below 1360 px the menu
 * opens as a full screen.
 */
export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const focused = header.current?.contains(document.activeElement);
        setScrolled(y > 8);
        if (Math.abs(y - last) < 6) return;
        setHidden(y > last && y > 120 && !focused);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <header
        ref={header}
        onFocusCapture={() => setHidden(false)}
        className={cn(
          "page fixed inset-x-0 top-0 z-40 flex h-(--header-h) items-center gap-4 bg-paper/95 backdrop-blur-md",
          "transition-[transform,box-shadow] duration-(--duration-base) ease-out",
          scrolled && "shadow-[0_1px_0_var(--hairline)]",
          hidden && "-translate-y-full",
        )}
      >
        <Brand />

        <nav aria-label={t("label")} className="ml-auto hidden nav:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className="group relative inline-flex min-h-11 items-center gap-1.5 px-2.5 text-[1rem] font-medium whitespace-nowrap"
                  >
                    {current && <Tremas className="text-[0.75rem]" />}
                    {t(item.key)}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2.5 bottom-2 h-[1.5px] origin-left scale-x-0 bg-croy transition-transform duration-(--duration-fast) ease-out group-hover:scale-x-100"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 nav:ml-2">
          <Link href="/recherche" className={iconButton}>
            <SearchIcon />
            <span className="sr-only">{t("search")}</span>
          </Link>
          <LanguageSwitcher className="hidden nav:block" />
          <Link
            href="/connexion"
            className="ml-1 hidden min-h-11 items-center rounded-xs border border-ink px-4 text-caption font-medium transition-colors duration-(--duration-fast) hover:bg-ink hover:text-paper nav:inline-flex"
          >
            {t("signIn")}
          </Link>
          <button
            type="button"
            className={cn(iconButton, "-mr-2.5 nav:hidden")}
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            onClick={() => setMenuOpen(true)}
          >
            <span className="sr-only">{t("openMenu")}</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
              <path
                d="M3 6h14M3 10h14M3 14h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
      />
    </>
  );
}

function MobileMenu({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const t = useTranslations("nav");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Closes the menu once the new page is shown.
  const shownPath = useRef(pathname);
  useEffect(() => {
    if (shownPath.current !== pathname) {
      shownPath.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return (
    <dialog
      ref={ref}
      id="menu-principal"
      aria-label={t("label")}
      className="menu-sheet"
      onClose={onClose}
    >
      <div className="page flex min-h-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex h-(--header-h) shrink-0 items-center">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            className={cn(iconButton, "-mr-2.5 ml-auto")}
          >
            <span className="sr-only">{t("closeMenu")}</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
              <path
                d="M4.5 4.5 15.5 15.5M15.5 4.5 4.5 15.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav aria-label={t("label")} className="mt-6 flex-1">
          <ul className="grid gap-1">
            {mainNav.map((item, i) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li
                  key={item.href}
                  className="menu-item"
                  style={{ animationDelay: `${60 + i * 35}ms` }}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={current ? "page" : undefined}
                    className="flex min-h-14 items-center gap-3 font-display text-title-sm"
                  >
                    {t(item.key)}
                    {current && <Tremas className="text-[1rem]" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-10 grid gap-6 border-t border-hairline pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/connexion"
              onClick={onClose}
              className="inline-flex min-h-12 items-center rounded-xs border border-ink px-5 font-medium"
            >
              {t("signIn")}
            </Link>
            <Link
              href="/recherche"
              onClick={onClose}
              className="inline-flex min-h-12 items-center gap-2 px-3 font-medium"
            >
              <SearchIcon />
              {t("search")}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </dialog>
  );
}
