"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Card, CardHead, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { SHEET_STATUS, fmtDow, fmtMinutes, isLocked, parseDuration, underLogged } from "@/lib/modules/personal/logic";
import type { GridRow } from "@/lib/modules/personal/logic";
import type { SheetStatus } from "@/lib/modules/personal/types";
import { setDayTotal, submitWeek } from "../actions";

type Props = {
  title: string;
  weekStart: string;
  days: string[];
  rows: GridRow[];
  clocked: number[];
  status: SheetStatus;
  returnNote: string | null;
  today: string;
  /** Viewing someone else's week. */
  readOnly: boolean;
  approver: string | null;
  nav: { prev: string; next: string | null };
};

const show = (m: number) => (m ? fmtMinutes(m) : "");

export function WeekGrid(p: Props) {
  const [vals, setVals] = useState(() => p.rows.map((r) => r.days.map(show)));
  const [pending, start] = useTransition();
  const toast = useToast();
  const locked = isLocked(p.status) || p.readOnly;
  const st = SHEET_STATUS[p.status];

  const mins = (v: string) => parseDuration(v) ?? 0;
  const rowTotal = (r: number) => vals[r].reduce((a, v) => a + mins(v), 0);
  const dayTotal = (d: number) => vals.reduce((a, row) => a + mins(row[d]), 0);
  const total = p.days.reduce((a, _, d) => a + dayTotal(d), 0);
  const clockedTotal = p.clocked.reduce((a, b) => a + b, 0);

  function edit(r: number, d: number, v: string) {
    setVals((cur) => cur.map((row, i) => (i === r ? row.map((x, j) => (j === d ? v : x)) : row)));
  }

  function commit(r: number, d: number) {
    const v = vals[r][d];
    const m = parseDuration(v);
    if (m === null) return toast("Enter time like 1h 30m.");
    edit(r, d, show(m));
    if (m === p.rows[r].days[d]) return;
    start(async () => {
      const res = await setDayTotal({ ticketId: p.rows[r].ticketId, date: p.days[d], value: v });
      if (!res.ok) {
        edit(r, d, show(p.rows[r].days[d]));
        return toast(res.error);
      }
      toast("Saved");
    });
  }

  function submit() {
    start(async () => {
      const r = await submitWeek(p.weekStart);
      toast(r.ok ? `Week submitted${p.approver ? ` to ${p.approver}` : ""} for approval` : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title={p.title}
        actions={
          <>
            <Link href={p.nav.prev} className="btn sm ghost">Previous</Link>
            {p.nav.next ? <Link href={p.nav.next} className="btn sm ghost">Next</Link> : null}
            <StatusDot tone={st.tone}>{st.label}</StatusDot>
            {underLogged(total, clockedTotal) ? <StatusDot tone="danger">Logged under 50% of clocked</StatusDot> : null}
            {!p.readOnly ? (
              <Button variant="primary" size="sm" disabled={locked || pending} onClick={submit}>
                {isLocked(p.status) ? "Week submitted" : "Submit week"}
              </Button>
            ) : null}
          </>
        }
      />
      {p.status === "returned" && p.returnNote ? (
        <div className="card-body pb-0">
          <StatusDot tone="warn">Returned: {p.returnNote}</StatusDot>
        </div>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>Ticket</Th>
            {p.days.map((d) => (
              <Th key={d} right>{fmtDow(d)}</Th>
            ))}
            <Th right>Total</Th>
          </tr>
        </thead>
        <tbody>
          {p.rows.length ? (
            p.rows.map((row, r) => (
              <tr key={row.ticketId ?? "none"}>
                <Td className="whitespace-nowrap">
                  {row.key ? <Link href={`/t/${row.key}`}>{row.key}</Link> : <span className="muted">Internal</span>}
                  <span className="small muted block min-w-[160px] whitespace-normal">{row.title}</span>
                </Td>
                {p.days.map((d, i) => (
                  <Td key={d} right>
                    <input
                      className="num w-[68px] rounded-md border border-line bg-surface px-1.5 py-1 text-right text-ink disabled:border-transparent disabled:bg-transparent disabled:text-ink-2"
                      value={vals[r][i]}
                      disabled={locked || d > p.today}
                      aria-label={`${row.key ?? "No ticket"} ${fmtDow(d)}`}
                      onChange={(e) => edit(r, i, e.currentTarget.value)}
                      onBlur={() => commit(r, i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  </Td>
                ))}
                <Td right num>{fmtMinutes(rowTotal(r))}</Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={9} className="muted">No time logged this week. Start the timer or use Log time.</Td>
            </tr>
          )}
        </tbody>
        <tfoot className="font-semibold">
          <tr>
            <Td>Logged</Td>
            {p.days.map((d, i) => (
              <Td key={d} right num>{fmtMinutes(dayTotal(i))}</Td>
            ))}
            <Td right num>{fmtMinutes(total)}</Td>
          </tr>
          <tr>
            <Td>Clocked</Td>
            {p.clocked.map((c, i) => (
              <Td key={p.days[i]} right num className="muted">{fmtMinutes(c)}</Td>
            ))}
            <Td right num className="muted">{fmtMinutes(clockedTotal)}</Td>
          </tr>
        </tfoot>
      </Table>
    </Card>
  );
}
