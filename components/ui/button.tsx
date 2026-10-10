import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/design/cn";
import { BandsLoader } from "./bands";
import { Link } from "@/lib/i18n/navigation";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "sm";

const variants: Record<ButtonVariant, string> = {
  // Red is the accent: one primary action per screen.
  primary:
    "bg-croy text-on-croy hover:bg-croy-deep aria-[busy=true]:bg-croy-deep",
  secondary:
    "border border-ink text-ink hover:bg-ink hover:text-paper aria-[busy=true]:bg-paper-2",
  ghost:
    "text-ink underline decoration-croy decoration-[1.5px] underline-offset-[0.28em] hover:decoration-[3px]",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-6 text-[1rem]",
  sm: "min-h-11 px-4 text-caption",
};

/** Shared look of buttons and button-like links. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "relative inline-flex items-center justify-center gap-2 rounded-xs font-medium leading-tight whitespace-nowrap select-none",
    "transition-[background-color,color,border-color,text-decoration-thickness,transform] duration-(--duration-fast) ease-out",
    "active:scale-[0.97] active:duration-(--duration-press)",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    variant === "ghost" && "px-1",
    variants[variant],
    variant !== "ghost" && sizes[size],
    variant === "ghost" && size === "sm" && "text-caption",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows the three-band loader and blocks double submissions. */
  busy?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant,
  size,
  busy = false,
  icon,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      {...props}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 transition-opacity duration-(--duration-fast)",
          busy && "opacity-0",
        )}
      >
        {children}
        {icon}
      </span>
      {busy && (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center"
        >
          <BandsLoader className="w-6" />
        </span>
      )}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

/** A link that looks like a button, for navigation. */
export function ButtonLink({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
      {icon}
    </Link>
  );
}
