"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Button, Checkbox, Dialog, EmptyState, Field, FormGrid, StatusDot, Table, Tabs, Td, Th, useToast } from "@/components/ui";
import { daysBetween, fmtDate, fmtDay, money } from "@/lib/modules/finance/core/logic";
import { STAGES, STAGE_LABEL, firstName, resultTone, type Stage } from "@/lib/modules/finance/ops/logic";
import type { OpsSettings, ReminderRow } from "@/lib/modules/finance/ops/types";
import { markSent, pauseReminders, resumeReminders, saveReminderRules, setAuto, skipReminder } from "../actions";
import s from "../../payments/_components/ops.module.css";

type List = "today" | "paused" | "upcoming" | "recent";
type Props = { lists: Record<List, ReminderRow[]>; settings: OpsSettings; today: string; canSend: boolean };

function draft(r: ReminderRow, today: string, tellAm: boolean) {
  const late = Math.max(daysBetween(r.due, today), 0);
  const cc = [r.cc, r.stage === "late_30" && tellAm ? r.ownerEmail : null].filter(Boolean).join(", ");
  const subject = late > 0 ? `Overdue: ${r.number} was due on ${fmtDay(r.due)}` : `Reminder: ${r.number} is due on ${fmtDay(r.due)}`;
  const body = `Hi ${firstName(r.contact)},\n\n${
    late > 0 ? `Invoice ${r.number} is now ${late} ${late === 1 ? "day" : "days"} past due.` : `A quick reminder that invoice ${r.number} is due on ${fmtDate(r.due)}.`
  } The balance is ${money(r.balance, r.currency)}.\n\n${r.channelName ? `You can pay by ${r.channelName}. ` : ""}Details are on the attached invoice.\n\nThanks,\nPermanent SEO`;
  return { to: r.billingEmail, cc, subject, body };
}

export function RemindersView({ lists, settings, today, canSend }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<List>("today");
  const [sending, setSending] = useState<ReminderRow | null>(null);
  const [mail, setMail] = useState({ to: "", cc: "", subject: "", body: "" });
  const [pausing, setPausing] = useState<ReminderRow | null>(null);
  const [bulk, setBulk] = useState(false);
  const [rules, setRules] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error ?? "Something went wrong.");
      toast(done);
      after?.();
      router.refresh();
    });

  const openSend = (r: ReminderRow) => {
    setMail(draft(r, today, settings.tellAmAt30));
    setSending(r);
  };

  const n = lists.today.length;
  const lastHead = tab === "paused" ? "Paused" : tab === "recent" ? "Sent" : "Send on";
  const rows = lists[tab];

  return (
    <>
      <div className="row between">
        <h1>Payment reminders</h1>
        {canSend ? (
          <div className="row">
            <Button onClick={() => setRules(true)}>Reminder rules</Button>
            <Button variant="primary" disabled={!n} onClick={() => setBulk(true)}>
              Send all {n}
            </Button>
          </div>
        ) : null}
      </div>
      <p className="muted small">
        Reminders go 3 days before due, then 1, 7, 14 and 30 days late. Clients on auto get them in the {settings.reminderRunTime} daily run.
      </p>

      <Tabs
        label="Reminder lists"
        value={tab}
        onChange={(v) => setTab(v as List)}
        items={[
          { value: "today", label: "Due today", count: n },
          { value: "paused", label: "Paused" },
          { value: "upcoming", label: "Upcoming" },
          { value: "recent", label: "Recent" },
        ]}
      />

      <section className="card">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Invoice</Th>
                <Th right>Balance</Th>
                <Th>Due</Th>
                <Th>Stage</Th>
                <Th>{lastHead}</Th>
                <Th>{tab === "recent" ? "Result" : "Mode"}</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const late = daysBetween(r.due, today);
                return (
                  <tr key={r.id}>
                    <Td>
                      {r.clientName}
                      {r.ownerName ? (
                        <div className="small muted row" style={{ gap: 6 }}>
                          <Avatar name={r.ownerName} size={18} /> {r.ownerName}
                        </div>
                      ) : null}
                    </Td>
                    <Td num>
                      <Link href={`/finance/invoices/${r.invoiceId}`}>{r.number}</Link>
                    </Td>
                    <Td right num>
                      {money(r.balance, r.currency)}
                    </Td>
                    <Td num>
                      {fmtDay(r.due)}
                      {late > 0 && tab !== "recent" ? <div className="small t-danger">{late} days late</div> : null}
                    </Td>
                    <Td>
                      {STAGE_LABEL[r.stage]}
                      {r.stage === "late_30" && settings.tellAmAt30 ? <div className="small muted">Account manager told too</div> : null}
                    </Td>
                    <Td num>
                      {tab === "paused" ? (
                        <>
                          Until {fmtDay(r.pausedUntil)}
                          {r.pauseNote ? <div className={`small muted ${s.wrapNote}`}>{r.pauseNote}</div> : null}
                        </>
                      ) : tab === "recent" ? (
                        <>
                          {fmtDay((r.sentAt ?? r.sendOn).slice(0, 10))}
                          <div className="small muted">{r.sentByName ?? (r.auto ? "Auto (daily run)" : "—")}</div>
                        </>
                      ) : (
                        fmtDay(r.sendOn)
                      )}
                    </Td>
                    <Td>
                      {tab === "recent" ? (
                        <StatusDot tone={resultTone(r.result)}>{r.result ?? "Sent"}</StatusDot>
                      ) : (
                        <Checkbox
                          label="Auto"
                          checked={r.auto}
                          disabled={!canSend || pending}
                          onChange={(e) =>
                            run(() => setAuto({ invoiceId: r.invoiceId, auto: e.target.checked }), `Auto reminders ${e.target.checked ? "on" : "off"} for ${r.number}`)
                          }
                        />
                      )}
                    </Td>
                    <Td right>
                      {canSend ? (
                        <div className={s.rowActions}>
                          {tab === "today" ? (
                            <>
                              <Button size="sm" variant="primary" onClick={() => openSend(r)}>
                                Send
                              </Button>
                              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => skipReminder({ id: r.id }), `Skipped ${STAGE_LABEL[r.stage].toLowerCase()} for ${r.number}`)}>
                                Skip
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPausing(r)}>
                                Pause
                              </Button>
                            </>
                          ) : tab === "upcoming" ? (
                            <Button size="sm" variant="ghost" onClick={() => setPausing(r)}>
                              Pause
                            </Button>
                          ) : tab === "paused" ? (
                            <Button size="sm" disabled={pending} onClick={() => run(() => resumeReminders({ invoiceId: r.invoiceId }), `Reminders resumed for ${r.number}`)}>
                              Resume
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title={
              tab === "today" ? "No reminders to send today." : tab === "paused" ? "No paused reminders." : tab === "upcoming" ? "Nothing coming up." : "No reminders sent yet."
            }
          />
        )}
      </section>

      <Dialog
        open={!!sending}
        onClose={() => setSending(null)}
        title="Review reminder"
        footer={
          sending ? (
            <>
              <Button variant="ghost" onClick={() => setSending(null)}>
                Cancel
              </Button>
              <a
                className="btn"
                href={`mailto:${mail.to}?${new URLSearchParams({ cc: mail.cc, subject: mail.subject, body: mail.body }).toString().replace(/\+/g, "%20")}`}
              >
                Open in email app
              </a>
              <Button variant="primary" disabled={pending} onClick={() => run(() => markSent({ ids: [sending.id], mail: mail.to.trim() && mail.subject.trim() && mail.body.trim() ? mail : undefined }), `Reminder for ${sending.number} marked as sent`, () => setSending(null))}>
                Mark as sent
              </Button>
            </>
          ) : null
        }
      >
        {sending ? (
          <div className="stack">
            <div className={`${s.note} ${s.noteWarn}`}>Email sending isn&apos;t connected yet. Send this from your email app, then mark it as sent.</div>
            <FormGrid>
              <Field label="To" htmlFor="rm-to" full>
                <input id="rm-to" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
              </Field>
              <Field label="Cc" htmlFor="rm-cc" full>
                <input id="rm-cc" value={mail.cc} onChange={(e) => setMail({ ...mail, cc: e.target.value })} />
              </Field>
              <Field label="Subject" htmlFor="rm-subject" full>
                <input id="rm-subject" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
              </Field>
              <Field label="Message" htmlFor="rm-body" full>
                <textarea id="rm-body" rows={8} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
              </Field>
            </FormGrid>
            <div className="small muted">
              Attach <strong>{sending.number}.pdf</strong> from the invoice page.
            </div>
          </div>
        ) : null}
      </Dialog>

      <PauseDialog key={pausing?.id ?? "none"} row={pausing} today={today} onClose={() => setPausing(null)} onSave={(until, note) => {
        const r = pausing!;
        run(() => pauseReminders({ invoiceId: r.invoiceId, until, note }), `Reminders paused for ${r.number}`, () => setPausing(null));
      }} busy={pending} />

      <Dialog
        open={bulk}
        onClose={() => setBulk(false)}
        title={`Send ${n} reminders now`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending || !n} onClick={() => run(() => markSent({ ids: lists.today.map((r) => r.id) }), `${n} reminders marked as sent`, () => setBulk(false))}>
              Mark {n} as sent
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className={`${s.note} ${s.noteWarn}`}>Email sending isn&apos;t connected yet. Send these from your email app, then mark them as sent.</div>
          <div className="list">
            {lists.today.map((r) => (
              <div key={r.id} className="item row between">
                <span>
                  {r.clientName} · <span className="num">{r.number}</span>
                  <div className="small muted">
                    {STAGE_LABEL[r.stage]} · {r.billingEmail || "no billing email"}
                  </div>
                </span>
                <span className="num">{money(r.balance, r.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </Dialog>

      <RulesDialog open={rules} settings={settings} onClose={() => setRules(false)} />
    </>
  );
}

function PauseDialog({ row, today, onClose, onSave, busy }: { row: ReminderRow | null; today: string; onClose: () => void; onSave: (until: string, note: string) => void; busy: boolean }) {
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={!!row}
      onClose={onClose}
      title={row ? `Pause reminders for ${row.number}` : "Pause reminders"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="pause-form" disabled={busy}>
            Pause reminders
          </Button>
        </>
      }
    >
      <form
        id="pause-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(until, note);
        }}
      >
        <FormGrid>
          <Field label="Pause until" htmlFor="pz-until">
            <input id="pz-until" type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} required />
          </Field>
          <Field label="Note" htmlFor="pz-note" full>
            <textarea id="pz-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why, so the team knows" maxLength={500} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

function RulesDialog({ open, settings, onClose }: { open: boolean; settings: OpsSettings; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [stages, setStages] = useState<Stage[]>(settings.reminderStages);
  const [tellAm, setTellAm] = useState(settings.tellAmAt30);
  const [runTime, setRunTime] = useState(settings.reminderRunTime);
  const [from, setFrom] = useState(settings.reminderFrom);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reminder rules"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="rules-form" disabled={busy}>
            Save rules
          </Button>
        </>
      }
    >
      <form
        id="rules-form"
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await saveReminderRules({ stages, tellAm, runTime, from });
          setBusy(false);
          if (!res.ok) return toast(res.error);
          toast("Reminder rules saved");
          onClose();
          router.refresh();
        }}
      >
        {STAGES.map((st) => (
          <Checkbox
            key={st}
            label={STAGE_LABEL[st]}
            checked={stages.includes(st)}
            onChange={(e) => setStages(e.target.checked ? STAGES.filter((x) => x === st || stages.includes(x)) : stages.filter((x) => x !== st))}
          />
        ))}
        <Checkbox label="Tell the account manager at 30 days late" checked={tellAm} onChange={(e) => setTellAm(e.target.checked)} />
        <FormGrid>
          <Field label="Daily run time (Dubai)" htmlFor="rr-time">
            <input id="rr-time" type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} required />
          </Field>
          <Field label="Send from" htmlFor="rr-from">
            <input id="rr-from" type="email" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}
