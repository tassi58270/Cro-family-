import type { ComponentProps } from "react";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

/** Two letters for a portrait placeholder: first name and last name initials. */
export function initials(name: string): string {
  const words = name
    .split(/[\s-]+/)
    .filter((w) => w && w[0] === w[0].toUpperCase());
  if (words.length === 0) return [...name.trim()].slice(0, 1).join("");
  const letters = words.length > 1 ? [words[0], words.at(-1)!] : words;
  return letters.map((w) => [...w][0]).join("");
}

/** A person as a small round badge (« pastille »), linking to their page. */
export function PersonChip({
  name,
  href,
  portrait,
  className,
}: {
  name: string;
  href: ComponentProps<typeof Link>["href"];
  /** URL of a small portrait; initials are shown without it. */
  portrait?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-hairline bg-paper py-1 pr-3.5 pl-1 text-caption font-medium",
        "transition-[border-color,transform] duration-(--duration-fast) ease-out hover:border-ink active:scale-[0.97]",
        className,
      )}
    >
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny avatar, already sized by the server.
        <img
          src={portrait}
          alt=""
          className="size-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-paper-2 font-display text-[0.8125rem] leading-none"
        >
          {initials(name)}
        </span>
      )}
      <span className="truncate">{name}</span>
    </Link>
  );
}

/** A filter that can be switched on and off. */
export function FilterChip({
  pressed,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-caption font-medium select-none",
        "transition-[background-color,color,border-color,transform] duration-(--duration-fast) ease-out active:scale-[0.97]",
        pressed
          ? "border-ink bg-ink text-paper"
          : "border-hairline-strong text-ink hover:border-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export type ContentStatus = "draft" | "pending" | "published" | "rejected";

const statusStyles: Record<ContentStatus, string> = {
  draft: "border-hairline-strong text-ink-muted",
  pending: "border-croy text-croy-text",
  published: "border-ink bg-ink text-paper",
  rejected: "border-hairline text-ink-muted line-through",
};

/** Status of a piece of content: draft, waiting for validation, published, refused. */
export function StatusChip({
  status,
  children,
  className,
}: {
  status: ContentStatus;
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.8125rem] leading-none font-medium",
        statusStyles[status],
        className,
      )}
    >
      {status === "pending" && (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-croy" />
      )}
      {children}
    </span>
  );
}
