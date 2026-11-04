"use client";

import { useState, useTransition } from "react";
import { Select, Table, Td, Th, useToast } from "@/components/ui";
import type { Scope } from "@/lib/auth/perms";
import { setOverride } from "../../../actions";

type Row = { key: string; label: string; fromRoles: Scope; override: Scope | "default" };

/** One select per permission; a change saves straight away. "From roles" removes the override. */
export function OverridesTable({ memberId, isSelf, isSuper, rows }: { memberId: string; isSelf: boolean; isSuper: boolean; rows: Row[] }) {
  const toast = useToast();
  const [values, setValues] = useState(() => Object.fromEntries(rows.map((r) => [r.key, r.override])));
  const [pending, start] = useTransition();

  return (
    <Table>
      <thead>
        <tr>
          <Th>Permission</Th>
          <Th hideSm>From roles</Th>
          <Th>Override</Th>
          <Th>Effective</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const v = values[r.key];
          const effective = isSuper ? "all" : v === "default" ? r.fromRoles : v;
          const locked = isSuper || (isSelf && r.key === "admin.access.manage");
          return (
            <tr key={r.key}>
              <Td>
                <code>{r.key}</code>
                <div className="small muted">{r.label}</div>
              </Td>
              <Td hideSm>{r.fromRoles}</Td>
              <Td>
                <Select
                  aria-label={`Override for ${r.key}`}
                  value={v}
                  disabled={locked || pending}
                  title={isSuper ? "Super admin has every permission" : undefined}
                  onChange={(e) => {
                    const next = e.target.value as Scope | "default";
                    const prev = v;
                    setValues((cur) => ({ ...cur, [r.key]: next }));
                    start(async () => {
                      const res = await setOverride({ memberId, perm: r.key, scope: next });
                      if (!res.ok) setValues((cur) => ({ ...cur, [r.key]: prev }));
                      toast(res.ok ? (next === "default" ? "Override removed" : "Override saved") : res.error);
                    });
                  }}
                >
                  <option value="default">From roles</option>
                  <option value="none">none</option>
                  <option value="own">own</option>
                  <option value="team">team</option>
                  <option value="all">all</option>
                </Select>
              </Td>
              <Td className={v !== "default" && !isSuper ? "font-semibold" : undefined}>{effective}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
