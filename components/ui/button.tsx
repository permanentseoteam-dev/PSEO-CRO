import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger" | "primary-danger";
type Size = "md" | "sm";

function classes(variant: Variant, size: Size, className?: string) {
  return cn(
    "btn",
    variant === "primary" && "primary",
    variant === "ghost" && "ghost",
    variant === "danger" && "danger",
    variant === "primary-danger" && "primary danger",
    size === "sm" && "sm",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

/** Button. Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = "default", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

/** A link styled as a button. */
export function ButtonLink({ variant = "default", size = "md", className, ...rest }: ButtonLinkProps) {
  return <Link className={classes(variant, size, className)} {...rest} />;
}

type IconButtonProps = ComponentProps<"button"> & { label: string; size?: Size };

/** Square icon-only button. `label` becomes aria-label and title. */
export function IconButton({ label, size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} className={cn("icon-btn", size === "sm" && "sm", className)} {...rest} />;
}
