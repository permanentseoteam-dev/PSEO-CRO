import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cn("card", className)} {...rest} />;
}

/** Card header: an h3 title on the left, optional actions on the right. */
export function CardHead({ title, actions, className }: { title: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("card-head", className)}>
      <h3>{title}</h3>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("card-body", className)} {...rest} />;
}
