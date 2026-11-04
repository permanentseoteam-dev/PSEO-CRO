"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Card, CardHead, Dialog, EmptyState, Field, FormGrid, IconButton, Input, Select, StatCard, Stats, StatusDot, Table, Td, Textarea, Th, useToast } from "@/components/ui";
import { addUpworkWithdrawal, deleteUpworkEarning, saveUpworkEarning } from "../actions";
import { fmtDate, fmtMoney, UPWORK_FEE_PCT, UPWORK_STATUS, upworkFee } from "../logic";
import { CURRENCIES, UPWORK_STATUSES, type UpworkEarning, type UpworkWithdrawal } from "../types";

type Stats = { earned: number; fees: number; pending: number; withdrawn: number; lastAccount: string | null };

/** Invoices > Upwork earnings: cards, contracts table (manual entry) and withdrawals. */
export function UpworkPanel({
  earnings,
  withdrawals,
  stats,
  today,
  canRecord,
}: {
  earnings: UpworkEarning[];
  withdrawals: UpworkWithdrawal[];
  stats: Stats;
  today: string;
  canRecord: boolean;
}) {
  const [editing, setEditing] = useState<UpworkEarning | "new" | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();

  function remove(e: UpworkEarning) {
    if (!confirm(`Delete "${e.contract}"?`)) return;
    start(async () => {
      const r = await deleteUpworkEarning(e.id);
      toast(r.ok ? "Earning deleted" : r.error);
    });
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Stats>
        <StatCard label="Earned this month" value={fmtMoney(stats.earned, "USD")} />
        <StatCard label="Upwork fees" value={fmtMoney(stats.fees, "USD")} sub={`${UPWORK_FEE_PCT}% service fee`} />
        <StatCard label="Pending release" value={fmtMoney(stats.pending, "USD")} sub="After fees" />
        <StatCard label="Withdrawn" value={fmtMoney(stats.withdrawn, "USD")} sub={stats.lastAccount ? `To ${stats.lastAccount}` : "This month"} />
      </Stats>
      <Card>
        <CardHead
          title="Contracts"
          actions={
            canRecord ? (
              <>
                <Button size="sm" onClick={() => setWithdrawing(true)}>
                  Record withdrawal
                </Button>
                <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
                  Add earning
                </Button>
              </>
            ) : null
          }
        />
        {earnings.length === 0 ? (
          <EmptyState title="No Upwork earnings yet">Add each contract payment as it lands in Upwork.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Contract</Th>
                <Th>Client</Th>
                <Th hideSm>Type</Th>
                <Th right hideSm>
                  Hours
                </Th>
                <Th right>Earned</Th>
                <Th right hideSm>
                  Fee
                </Th>
                <Th>Status</Th>
                {canRecord ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {earnings.map((e) => (
                <tr key={e.id}>
                  <Td>
                    {e.contract}
                    <div className="small muted">{fmtDate(e.earned_on)}</div>
                  </Td>
                  <Td>{e.upwork_client}</Td>
                  <Td hideSm>{e.kind === "hourly" ? "Hourly" : "Fixed"}</Td>
                  <Td right num hideSm>
                    {e.hours ?? "—"}
                  </Td>
                  <Td right num>
                    {fmtMoney(e.earned, e.currency)}
                  </Td>
                  <Td right num hideSm>
                    {fmtMoney(e.fee, e.currency)}
                  </Td>
                  <Td>
                    <StatusDot tone={UPWORK_STATUS[e.status].tone}>{UPWORK_STATUS[e.status].label}</StatusDot>
                  </Td>
                  {canRecord ? (
                    <Td right>
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <IconButton size="sm" label="Edit" onClick={() => setEditing(e)}>
                          <Pencil size={14} />
                        </IconButton>
                        <IconButton size="sm" label="Delete" disabled={busy} onClick={() => remove(e)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {withdrawals.length ? (
        <Card>
          <CardHead title="Withdrawals" />
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>To</Th>
                <Th right>Amount</Th>
                <Th hideSm>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.slice(0, 12).map((w) => (
                <tr key={w.id}>
                  <Td num>{fmtDate(w.withdrawn_on)}</Td>
                  <Td>{w.to_account}</Td>
                  <Td right num>
                    {fmtMoney(w.amount, w.currency)}
                  </Td>
                  <Td hideSm>{w.reference ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
      {canRecord ? (
        <>
          <EarningDialog key={editing === "new" ? "new" : editing?.id ?? "none"} row={editing} today={today} onClose={() => setEditing(null)} />
          <WithdrawalDialog open={withdrawing} today={today} onClose={() => setWithdrawing(false)} />
        </>
      ) : null}
    </div>
  );
}

function EarningDialog({ row, today, onClose }: { row: UpworkEarning | "new" | null; today: string; onClose: () => void }) {
  const e = row && row !== "new" ? row : null;
  const [kind, setKind] = useState(e?.kind ?? "fixed");
  const [earned, setEarned] = useState(e ? String(e.earned) : "");
  const [busy, start] = useTransition();
  const toast = useToast();

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const r = await saveUpworkEarning({
        id: e?.id,
        contract: f.get("contract"),
        upwork_client: f.get("upwork_client"),
        kind,
        hours: f.get("hours"),
        earned: f.get("earned"),
        fee: f.get("fee"),
        currency: f.get("currency"),
        status: f.get("status"),
        earned_on: f.get("earned_on"),
        note: f.get("note"),
      });
      if (!r.ok) return toast(r.error);
      toast(e ? "Earning saved" : "Earning added");
      onClose();
    });
  }

  return (
    <Dialog
      open={!!row}
      onClose={onClose}
      title={e ? "Edit Upwork earning" : "Add Upwork earning"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="fp2-upwork" disabled={busy}>
            Save earning
          </Button>
        </>
      }
    >
      <form
        id="fp2-upwork"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit(ev.currentTarget);
        }}
      >
        <FormGrid>
          <Field label="Contract" htmlFor="fp2-uw-contract" full>
            <Input id="fp2-uw-contract" name="contract" required maxLength={200} defaultValue={e?.contract} />
          </Field>
          <Field label="Upwork client" htmlFor="fp2-uw-client">
            <Input id="fp2-uw-client" name="upwork_client" required maxLength={200} defaultValue={e?.upwork_client} />
          </Field>
          <Field label="Type" htmlFor="fp2-uw-kind">
            <Select id="fp2-uw-kind" value={kind} onChange={(ev) => setKind(ev.target.value as "fixed" | "hourly")}>
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </Select>
          </Field>
          {kind === "hourly" ? (
            <Field label="Hours" htmlFor="fp2-uw-hours">
              <Input id="fp2-uw-hours" name="hours" type="number" step="0.25" min="0" className="num" defaultValue={e?.hours ?? ""} />
            </Field>
          ) : null}
          <Field label="Earned" htmlFor="fp2-uw-earned">
            <Input id="fp2-uw-earned" name="earned" type="number" step="0.01" min="0" required className="num" value={earned} onChange={(ev) => setEarned(ev.target.value)} />
          </Field>
          <Field label="Fee" htmlFor="fp2-uw-fee">
            <Input
              id="fp2-uw-fee"
              name="fee"
              type="number"
              step="0.01"
              min="0"
              className="num"
              defaultValue={e?.fee}
              placeholder={earned ? String(upworkFee(Number(earned))) : `${UPWORK_FEE_PCT}% if left empty`}
            />
          </Field>
          <Field label="Currency" htmlFor="fp2-uw-cur">
            <Select id="fp2-uw-cur" name="currency" defaultValue={e?.currency ?? "USD"}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="fp2-uw-status">
            <Select id="fp2-uw-status" name="status" defaultValue={e?.status ?? "in_review"}>
              {UPWORK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {UPWORK_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="fp2-uw-date">
            <Input id="fp2-uw-date" name="earned_on" type="date" required defaultValue={e?.earned_on ?? today} />
          </Field>
          <Field label="Note" htmlFor="fp2-uw-note" full>
            <Textarea id="fp2-uw-note" name="note" rows={2} maxLength={1000} defaultValue={e?.note ?? ""} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

function WithdrawalDialog({ open, today, onClose }: { open: boolean; today: string; onClose: () => void }) {
  const [busy, start] = useTransition();
  const toast = useToast();

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const r = await addUpworkWithdrawal({
        amount: f.get("amount"),
        currency: f.get("currency"),
        withdrawn_on: f.get("withdrawn_on"),
        to_account: f.get("to_account"),
        reference: f.get("reference"),
      });
      if (!r.ok) return toast(r.error);
      toast("Withdrawal recorded");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record withdrawal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="fp2-withdraw" disabled={busy}>
            Save withdrawal
          </Button>
        </>
      }
    >
      <form
        id="fp2-withdraw"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit(ev.currentTarget);
        }}
      >
        <FormGrid>
          <Field label="Amount" htmlFor="fp2-wd-amt">
            <Input id="fp2-wd-amt" name="amount" type="number" step="0.01" min="0.01" required className="num" />
          </Field>
          <Field label="Currency" htmlFor="fp2-wd-cur">
            <Select id="fp2-wd-cur" name="currency" defaultValue="USD">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="fp2-wd-date">
            <Input id="fp2-wd-date" name="withdrawn_on" type="date" required defaultValue={today} />
          </Field>
          <Field label="To account" htmlFor="fp2-wd-to">
            <Input id="fp2-wd-to" name="to_account" required maxLength={120} placeholder="e.g. Wise USD ••7720" />
          </Field>
          <Field label="Reference" htmlFor="fp2-wd-ref" full>
            <Input id="fp2-wd-ref" name="reference" maxLength={120} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}
