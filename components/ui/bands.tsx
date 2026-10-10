import { cn } from "@/lib/design/cn";

/**
 * The signature motif: the three fasces of the coat of arms as three red
 * horizontal bands (cahier des charges, section 3).
 */

/** Section separator. The bands draw in from the left as they scroll into view. */
export function BandsRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bands-rule grid w-12 gap-[5px]", className)}
    >
      <span className="h-[3px] bg-croy" />
      <span className="h-[3px] bg-croy" />
      <span className="h-[3px] bg-croy" />
    </span>
  );
}

/** Loading indicator: the three bands breathing one after the other. */
export function BandsLoader({
  className,
  label,
}: {
  className?: string;
  /** Accessible text; omit when the loader is decorative. */
  label?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("grid aspect-[7/5] w-8 gap-[16%]", className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block origin-left animate-band bg-current"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

/** The dieresis of the ÿ: two red dots, used as a bullet or a marker. */
export function Tremas({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 gap-[0.3em]", className)}
    >
      <i className="size-[0.42em] rounded-full bg-croy" />
      <i className="size-[0.42em] rounded-full bg-croy" />
    </span>
  );
}
