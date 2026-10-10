import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/design/cn";
import { Link } from "@/lib/i18n/navigation";

type CardProps = {
  /** Where the whole card leads. The title carries the link. */
  href: ComponentProps<typeof Link>["href"];
  title: string;
  /** Short context above the title: an era, a date, a type. */
  eyebrow?: ReactNode;
  excerpt?: ReactNode;
  /** An image or illustration. Without it the card is text only. */
  media?: ReactNode;
  /** Small items under the text, usually person chips. */
  footer?: ReactNode;
  /** `feature` is the large story of the magazine layout. */
  size?: "default" | "feature";
  className?: string;
};

/**
 * A card leading to a story, a place, a person… Hovering it draws the three
 * red bands along its top edge, the signature motif.
 */
export function Card({
  href,
  title,
  eyebrow,
  excerpt,
  media,
  footer,
  size = "default",
  className,
}: CardProps) {
  const feature = size === "feature";

  return (
    <article
      className={cn(
        "group relative flex flex-col bg-paper",
        feature && "md:grid md:grid-cols-[1.4fr_1fr] md:gap-10",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-px z-10 grid gap-[3px]"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[2px] origin-left scale-x-0 bg-croy transition-transform duration-(--duration-base) ease-out group-focus-within:scale-x-100 group-hover:scale-x-100"
            style={{ transitionDelay: `${i * 50}ms` }}
          />
        ))}
      </span>

      {media && (
        <div
          className={cn(
            "relative overflow-hidden bg-paper-2",
            feature
              ? "aspect-[4/3] md:aspect-auto md:min-h-80"
              : "aspect-[4/3]",
          )}
        >
          <div className="h-full transition-transform duration-(--duration-slow) ease-out motion-safe:group-hover:scale-[1.03]">
            {media}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex flex-1 flex-col gap-3 pt-5",
          !media && "border-t border-hairline",
          feature && "md:justify-end md:pt-0",
        )}
      >
        {eyebrow && (
          <p className="tabular text-caption font-medium text-ink-muted">
            {eyebrow}
          </p>
        )}
        <h3
          className={cn(
            "font-display",
            feature ? "text-title" : "text-title-sm",
          )}
        >
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-croy"
          >
            {title}
          </Link>
        </h3>
        {excerpt && (
          <p
            className={cn(
              "text-ink-muted",
              feature ? "line-clamp-4 text-lead" : "line-clamp-3",
            )}
          >
            {excerpt}
          </p>
        )}
        {footer && (
          <div className="relative z-10 mt-auto flex flex-wrap gap-2 pt-2">
            {footer}
          </div>
        )}
      </div>
    </article>
  );
}
