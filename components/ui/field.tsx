import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Label + control + optional hint. Use inside <FormGrid>; `full` spans both columns. */
export function Field({
  label,
  htmlFor,
  hint,
  full,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("field", full && "full", className)}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/** Two-column form layout, one column under 600px. */
export function FormGrid({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("form-grid", className)} {...rest} />;
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} />;
}

/** Checkbox with its label on the right. */
export function Checkbox({ label, className, ...rest }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("check", className)}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
