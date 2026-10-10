import type { ReactNode } from "react";
import { Shield } from "@/components/heraldique/shield";
import { cn } from "@/lib/design/cn";

/**
 * What a section shows while the family has not filled it yet: an invitation
 * to contribute, never a hole or filler text (cahier des charges, section 7).
 */
export function EmptyState({
  title,
  body,
  action,
  className,
  headingLevel: Heading = "h2",
}: {
  title: string;
  body: ReactNode;
  /** Usually a ButtonLink towards the right form. */
  action?: ReactNode;
  className?: string;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 px-6 py-16 text-center md:py-24",
        className,
      )}
    >
      <Shield decorative className="w-14 md:w-16" />
      <Heading className="max-w-[22ch] font-display text-title">
        {title}
      </Heading>
      <div className="max-w-prose text-ink-muted">{body}</div>
      {action && (
        <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>
      )}
    </div>
  );
}
