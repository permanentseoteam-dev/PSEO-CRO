import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Scrollable table: <Table><thead>…</thead><tbody>…</tbody></Table>. Headers are sentence case. */
export function Table({ className, wrapClassName, ...rest }: ComponentProps<"table"> & { wrapClassName?: string }) {
  return (
    <div className={cn("table-wrap", wrapClassName)}>
      <table className={cn("tbl", className)} {...rest} />
    </div>
  );
}

type CellOpts = { right?: boolean; num?: boolean; hideSm?: boolean };
const cell = ({ right, num, hideSm }: CellOpts, className?: string) =>
  cn(right && "right", num && "num", hideSm && "hide-sm", className) || undefined;

export function Th({ right, num, hideSm, className, ...rest }: ComponentProps<"th"> & CellOpts) {
  return <th scope="col" className={cell({ right, num, hideSm }, className)} {...rest} />;
}

export function Td({ right, num, hideSm, className, ...rest }: ComponentProps<"td"> & CellOpts) {
  return <td className={cell({ right, num, hideSm }, className)} {...rest} />;
}
