"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A select that writes its value to ?<param>= so the server page re-renders with the filter. */
export function UrlSelect({
  param,
  label,
  value,
  options,
  allLabel,
}: {
  param: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set(param, e.target.value);
        else next.delete(param);
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
