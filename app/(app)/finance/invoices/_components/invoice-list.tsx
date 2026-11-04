"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, StatusDot, Table, Td, Th, type Tone } from "@/components/ui";
import { money, STATUS } from "@/lib/modules/finance/core/logic";
import s from "../../_core/finance.module.css";

export type ListRow = {
  id: string;
  label: string;
  title: string;
  client: string;
  clientId: string;
  entityId: string;
  entity: string;
  issued: string;
  due: string;
  currency: string;
  total: number;
  balance: number;
  status: { label: string; tone: Tone; sub?: string };
  keys: string[];
};

type Opt = { id: string; name: string };

/** Invoice table with instant search and filters (status incl. open and overdue, entity, client). */
export function InvoiceList({ rows, entities, clients }: { rows: ListRow[]; entities: Opt[]; clients: Opt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [ent, setEnt] = useState("");
  const [client, setClient] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!needle || `${r.label} ${r.client} ${r.title}`.toLowerCase().includes(needle)) &&
        (!st || r.keys.includes(st)) &&
        (!ent || r.entityId === ent) &&
        (!client || r.clientId === client),
    );
  }, [rows, q, st, ent, client]);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="toolbar row">
        <input type="search" placeholder="Search number, client or title" aria-label="Search invoices" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select aria-label="Entity" value={ent} onChange={(e) => setEnt(e.target.value)}>
          <option value="">All entities</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>Client</Th>
              <Th hideSm>Entity</Th>
              <Th>Issued</Th>
              <Th>Due</Th>
              <Th right>Total</Th>
              <Th right>Balance</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={s.clickRow} onClick={(e) => !(e.target as HTMLElement).closest("a") && router.push(`/finance/invoices/${r.id}`)}>
                <Td num>
                  <Link href={`/finance/invoices/${r.id}`}>{r.label}</Link>
                  <div className="small muted hide-sm">{r.title}</div>
                </Td>
                <Td>{r.client}</Td>
                <Td hideSm>{r.entity}</Td>
                <Td num>{r.issued}</Td>
                <Td num>{r.due}</Td>
                <Td num right>
                  {money(r.total, r.currency)}
                </Td>
                <Td num right>
                  {r.balance ? money(r.balance, r.currency) : <span className="muted">—</span>}
                </Td>
                <Td>
                  <StatusDot tone={r.status.tone}>{r.status.label}</StatusDot>
                  {r.status.sub ? <div className="small muted">{r.status.sub}</div> : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {shown.length === 0 ? <div className="empty">{rows.length ? "No invoices match these filters." : "No invoices yet."}</div> : null}
      </Card>
      <div className="small muted">{shown.length === rows.length ? `${rows.length} invoices` : `${shown.length} of ${rows.length} invoices`}</div>
    </div>
  );
}
