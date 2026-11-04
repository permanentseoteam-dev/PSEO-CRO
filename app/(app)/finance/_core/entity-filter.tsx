"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Entity select that writes ?entity= to the URL so the server page re-renders with the filter. */
export function EntityFilter({ entities, value }: { entities: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      aria-label="Entity"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("entity", e.target.value);
        else next.delete("entity");
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <option value="">All entities</option>
      {entities.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  );
}
