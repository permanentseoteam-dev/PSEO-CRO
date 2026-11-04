"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button, Card, CardBody, CardHead, Checkbox, Dialog, EmptyState, Field, FormGrid, Input, StatusDot, Table, Td, Textarea, Th } from "@/components/ui";
import { advanceQbr, createQbr, createReport, moveReport, saveReportDraft, saveReportSettings } from "../actions";
import { QBR_STATUS, lines, monthLabel, monthStart, nextQbrStatus, quarterLabel, quarterOf, reportLate, reportStatus, shortDate } from "../logic";
import type { MonthlyReport, Qbr, SuccessProfile } from "../types";
import { FormDialog, formValues, useRun } from "./shared";

type Props = {
  clientId: string;
  clientName: string;
  profile: SuccessProfile | null;
  reports: MonthlyReport[];
  qbrs: Qbr[];
  canManage: boolean;
  canApprove: boolean;
  emailConnected: boolean;
  today: string;
};

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function ReportsView(p: Props) {
  const { clientId, today } = p;
  const dueDay = p.profile?.report_due_day ?? 5;
  const autoSend = p.profile?.auto_send ?? false;
  const [selectedId, setSelectedId] = useState(() => (p.reports.find((r) => r.status !== "sent") ?? p.reports[0])?.id);
  const [dlg, setDlg] = useState<null | "settings" | "preview" | "changes" | "connect">(null);
  const { pending, run } = useRun();
  const close = () => setDlg(null);

  const selected = p.reports.find((r) => r.id === selectedId);
  const nextMonth = monthStart(today, -1);
  const hasLastMonth = p.reports.some((r) => r.month === nextMonth);
  const thisQuarter = quarterOf(today);
  const hasQuarter = p.qbrs.some((q) => q.quarter === thisQuarter);
  const editable = selected && p.canManage && (selected.status === "draft" || selected.status === "changes" || selected.status === "submitted");

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="between">
        <span className="small muted">
          Due on the {ordinal(dueDay)} of each month · auto-send when approved: {autoSend ? "on" : "off"}
        </span>
        <div className="row">
          {!p.emailConnected ? <StatusDot tone="muted">Email not connected</StatusDot> : null}
          {!p.emailConnected && p.canManage ? (
            <Button size="sm" onClick={() => setDlg("connect")}>
              Connect email
            </Button>
          ) : null}
          {p.canManage ? (
            <Button size="sm" onClick={() => setDlg("settings")}>
              Report settings
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHead
          title="Monthly reports"
          actions={
            p.canManage && !hasLastMonth ? (
              <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => createReport({ clientId, month: nextMonth }), `${monthLabel(nextMonth)} report started`)}>
                Start {monthLabel(nextMonth)} report
              </Button>
            ) : null
          }
        />
        {p.reports.length === 0 ? (
          <EmptyState icon={<FileText />} title="No reports yet">
            Start last month&apos;s report to draft highlights and a plan.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th>Status</Th>
                <Th>Due</Th>
                <Th hideSm>Owner</Th>
                <Th hideSm>Auto-send</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {p.reports.map((r) => {
                const s = reportStatus(r.status, r.had_changes);
                const late = reportLate(r.status, r.due_on, today);
                return (
                  <tr key={r.id}>
                    <Td>{r.id === selectedId ? <strong>{monthLabel(r.month)}</strong> : monthLabel(r.month)}</Td>
                    <Td>
                      <StatusDot tone={s.tone}>{s.label}</StatusDot>
                    </Td>
                    <Td className={late ? "t-danger num" : "num"}>
                      {shortDate(r.due_on, today)}
                      {late ? " · late" : ""}
                    </Td>
                    <Td hideSm>{r.owner?.name ?? ""}</Td>
                    <Td hideSm>{r.auto_send ? "On" : "Off"}</Td>
                    <Td right>
                      <Button size="sm" variant={r.id === selectedId ? "default" : "ghost"} onClick={() => setSelectedId(r.id)}>
                        Open
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid-2">
        {selected ? (
          <Card>
            <CardHead
              title={`${monthLabel(selected.month)} ${selected.status === "sent" ? "report" : "draft"}`}
              actions={
                <Button size="sm" variant="ghost" onClick={() => setDlg("preview")}>
                  Preview
                </Button>
              }
            />
            <CardBody>
              <form
                key={selected.id}
                className="stack"
                onSubmit={(e) => {
                  const v = formValues(e);
                  run(() => saveReportDraft({ clientId, id: selected.id, summary: v.summary, highlights: v.highlights, plan: v.plan }), "Draft saved");
                }}
              >
                {selected.status === "changes" && selected.changes_note ? (
                  <StatusDot tone="warn">Changes asked: {selected.changes_note}</StatusDot>
                ) : null}
                <Field label="Summary" htmlFor="cs-rep-summary">
                  <Textarea id="cs-rep-summary" name="summary" rows={2} defaultValue={selected.summary ?? ""} readOnly={!editable} />
                </Field>
                <Field label="Highlights" htmlFor="cs-rep-high">
                  <Textarea id="cs-rep-high" name="highlights" rows={4} defaultValue={selected.highlights ?? ""} readOnly={!editable} />
                </Field>
                <Field label={`Plan for ${monthLabel(monthStart(selected.month, 1)).split(" ")[0]}`} htmlFor="cs-rep-plan">
                  <Textarea id="cs-rep-plan" name="plan" rows={3} defaultValue={selected.plan ?? ""} readOnly={!editable} />
                </Field>
                <div className="row">
                  {editable ? (
                    <Button type="submit" disabled={pending}>
                      Save draft
                    </Button>
                  ) : null}
                  {p.canManage && (selected.status === "draft" || selected.status === "changes") ? (
                    <Button variant="primary" disabled={pending} onClick={() => run(() => moveReport({ clientId, id: selected.id, to: "submitted" }), "Submitted for review")}>
                      Submit for review
                    </Button>
                  ) : null}
                  {p.canApprove && selected.status === "submitted" ? (
                    <>
                      <Button disabled={pending} onClick={() => setDlg("changes")}>
                        Request changes
                      </Button>
                      <Button
                        variant="primary"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => moveReport({ clientId, id: selected.id, to: "approved" }),
                            selected.auto_send ? `Approved. Sends on ${shortDate(selected.due_on, today)}` : "Approved",
                          )
                        }
                      >
                        Approve
                      </Button>
                    </>
                  ) : null}
                  {p.canApprove && selected.status === "approved" ? (
                    p.emailConnected ? (
                      <Button variant="primary" disabled={pending} onClick={() => run(() => moveReport({ clientId, id: selected.id, to: "sent" }), "Report sent")}>
                        Send now
                      </Button>
                    ) : (
                      <Button variant="primary" disabled={pending} onClick={() => run(() => moveReport({ clientId, id: selected.id, to: "sent", byHand: true }), "Marked as sent")}>
                        Mark as sent
                      </Button>
                    )
                  ) : null}
                </div>
              </form>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHead
            title="Quarterly business reviews"
            actions={
              p.canManage && !hasQuarter ? (
                <Button size="sm" disabled={pending} onClick={() => run(() => createQbr({ clientId, quarter: thisQuarter }), `${quarterLabel(thisQuarter)} QBR added`)}>
                  Add {quarterLabel(thisQuarter)} QBR
                </Button>
              ) : null
            }
          />
          {p.qbrs.length === 0 ? (
            <p className="card-body small muted" style={{ margin: 0 }}>
              No QBRs yet.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Quarter</Th>
                  <Th>Status</Th>
                  <Th hideSm>Date</Th>
                  <Th hideSm>Deck</Th>
                  {p.canManage ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                {p.qbrs.map((q) => {
                  const s = QBR_STATUS[q.status];
                  const next = nextQbrStatus(q.status);
                  return (
                    <tr key={q.id}>
                      <Td>{quarterLabel(q.quarter)}</Td>
                      <Td>
                        <StatusDot tone={s.tone}>{s.label}</StatusDot>
                      </Td>
                      <Td hideSm className="num">
                        {q.meeting_on ? shortDate(q.meeting_on, today) : ""}
                      </Td>
                      <Td hideSm>
                        {q.deck_url ? (
                          <a href={q.deck_url} target="_blank" rel="noreferrer">
                            Deck
                          </a>
                        ) : (
                          <span className="muted">None</span>
                        )}
                      </Td>
                      {p.canManage ? (
                        <Td right>
                          {next && q.status !== "presented" ? (
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => run(() => advanceQbr({ clientId, id: q.id, from: q.status }), `${quarterLabel(q.quarter)} QBR marked ${QBR_STATUS[next].label.toLowerCase()}`)}
                            >
                              Mark {QBR_STATUS[next].label.toLowerCase()}
                            </Button>
                          ) : null}
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <FormDialog
        id="cs-rep-settings"
        title="Report settings"
        submitLabel="Save settings"
        pending={pending}
        open={dlg === "settings"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () => saveReportSettings({ clientId, report_due_day: Number(v.report_due_day), auto_send: v.auto_send, report_recipient: v.report_recipient }),
            "Report settings saved",
            close,
          );
        }}
      >
        <FormGrid>
          <Field label="Due day of the month (1 to 28)" htmlFor="cs-set-day">
            <Input id="cs-set-day" name="report_due_day" type="number" min={1} max={28} required defaultValue={dueDay} />
          </Field>
          <Field label="Send reports to" htmlFor="cs-set-to">
            <Input id="cs-set-to" name="report_recipient" type="email" maxLength={200} defaultValue={p.profile?.report_recipient ?? ""} />
          </Field>
          <div className="field full">
            <Checkbox name="auto_send" label="Send automatically on the due day once approved" defaultChecked={autoSend} />
          </div>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-rep-changes"
        title="Request changes"
        submitLabel="Send back"
        pending={pending}
        open={dlg === "changes"}
        setOpen={(o) => !o && close()}
        onSubmit={(e) => {
          const v = formValues(e);
          if (!selected) return;
          run(() => moveReport({ clientId, id: selected.id, to: "changes", changes_note: v.changes_note }), "Sent back with changes", close);
        }}
      >
        <Field label="What needs to change" htmlFor="cs-rep-note">
          <Textarea id="cs-rep-note" name="changes_note" rows={3} required />
        </Field>
      </FormDialog>

      <Dialog open={dlg === "preview"} onClose={close} title={selected ? `${monthLabel(selected.month)} report preview` : "Preview"}>
        {selected ? (
          <div className="stack small">
            <h4 style={{ margin: 0 }}>
              {p.clientName} · {monthLabel(selected.month)}
            </h4>
            {selected.summary ? <p style={{ margin: 0 }}>{selected.summary}</p> : null}
            <div>
              <strong>Highlights</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {lines(selected.highlights).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Next month</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {lines(selected.plan).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={dlg === "connect"} onClose={close} title="Connect email" footer={<Button onClick={close}>Close</Button>}>
        <p className="small" style={{ margin: 0 }}>
          Reports and rating requests go out through the workspace email provider, which isn&apos;t set up yet. An admin connects it in
          Settings. Until then, send the report yourself and use Mark as sent.
        </p>
      </Dialog>
    </div>
  );
}
