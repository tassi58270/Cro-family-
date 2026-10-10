"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small line above the title. */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** Sticky actions at the bottom of the panel. */
  footer?: ReactNode;
  className?: string;
};

/**
 * A panel that slides in from the right on large screens and rises as a
 * sheet from the bottom on phones. Built on the native modal <dialog>:
 * focus is trapped, Escape closes it and the page behind is inert.
 */
export function SidePanel({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  className,
}: SidePanelProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn("side-panel", className)}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[inherit] min-h-0 flex-col md:h-full">
        <span
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-hairline-strong md:hidden"
        />
        <header className="flex items-start gap-4 px-6 pt-4 pb-4 md:px-8 md:pt-8">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="mb-1 text-caption font-medium text-ink-muted">
                {eyebrow}
              </p>
            )}
            <h2 id={titleId} className="font-display text-title-sm">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1.5 -mr-3 grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-(--duration-fast) hover:bg-paper-2 active:scale-[0.94]"
          >
            <span className="sr-only">{t("close")}</span>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
              <path
                d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 md:px-8">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap gap-3 border-t border-hairline px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
