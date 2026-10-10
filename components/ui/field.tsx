import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/design/cn";

type FieldFrameProps = {
  label: ReactNode;
  /** Help under the label, in plain words. */
  hint?: ReactNode;
  /** Error message; also marks the control as invalid. */
  error?: ReactNode;
  /** Shown after the label for optional fields, e.g. « facultatif ». */
  optionalLabel?: string;
  className?: string;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
};

/** Label, hint and error around any form control, wired for screen readers. */
export function FieldFrame({
  label,
  hint,
  error,
  optionalLabel,
  className,
  children,
}: FieldFrameProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="font-medium">
        {label}
        {optionalLabel && (
          <span className="ml-2 text-caption font-normal text-ink-muted">
            {optionalLabel}
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="-mt-1 text-caption text-ink-muted">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p
          id={errorId}
          className="flex items-baseline gap-2 text-caption font-medium text-croy-text"
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-0.1em] rounded-full bg-croy"
          />
          {error}
        </p>
      )}
    </div>
  );
}

/** 16 px minimum so that phones never zoom into the field. */
const control = cn(
  "w-full rounded-xs border border-hairline-strong bg-paper px-4 text-[1rem] text-ink",
  "transition-[border-color,box-shadow] duration-(--duration-fast) ease-out",
  "placeholder:text-ink-muted hover:border-ink",
  "focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-croy",
  "aria-[invalid=true]:border-croy",
  "disabled:cursor-not-allowed disabled:bg-paper-2 disabled:opacity-70",
);

type BaseProps = Omit<FieldFrameProps, "children">;

export function TextField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...input
}: BaseProps & Omit<ComponentProps<"input">, "id">) {
  return (
    <FieldFrame {...{ label, hint, error, optionalLabel, className }}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "min-h-12")}
          {...input}
        />
      )}
    </FieldFrame>
  );
}

export function TextArea({
  label,
  hint,
  error,
  optionalLabel,
  className,
  rows = 5,
  ...textarea
}: BaseProps & Omit<ComponentProps<"textarea">, "id">) {
  return (
    <FieldFrame {...{ label, hint, error, optionalLabel, className }}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "min-h-32 resize-y py-3 leading-relaxed")}
          {...textarea}
        />
      )}
    </FieldFrame>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  children,
  ...select
}: BaseProps & Omit<ComponentProps<"select">, "id">) {
  return (
    <FieldFrame {...{ label, hint, error, optionalLabel, className }}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(control, "min-h-12 appearance-none pr-11")}
            {...select}
          >
            {children}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
          >
            <path
              d="M3.5 6 8 10.5 12.5 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </FieldFrame>
  );
}

/** A checkbox with its label on the right; the box fills with red when checked. */
export function Checkbox({
  label,
  hint,
  className,
  ...input
}: {
  label: ReactNode;
  hint?: ReactNode;
} & Omit<ComponentProps<"input">, "type" | "id">) {
  const id = useId();
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="relative -m-2.5 grid size-11 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="peer size-5 cursor-pointer appearance-none rounded-xs border-[1.5px] border-ink bg-paper transition-colors duration-(--duration-fast) checked:border-croy checked:bg-croy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-croy"
          {...input}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute size-3.5 text-on-croy opacity-0 transition-opacity duration-(--duration-fast) peer-checked:opacity-100"
        >
          <path
            d="M3 8.5 6.5 12 13 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="grid gap-0.5 pt-px">
        <label htmlFor={id} className="cursor-pointer">
          {label}
        </label>
        {hint && (
          <span id={`${id}-hint`} className="text-caption text-ink-muted">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}
