"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Avatar, Button, ButtonLink, Card, CardBody, CardHead, Checkbox, Dialog, EmptyState, Field, FormGrid, IconButton, Input, Select, StatusDot, Table, Td, Th } from "@/components/ui";
import { handleAlert, saveCapacity, saveWorkloadSettings, undoAlert } from "../actions";
import { ALERT_LABEL, dayHead, dayTone, loadTone, moveTargets, weekDays, weekTitle, WEEKDAYS } from "../logic";
import { DEFAULT_CAPACITY, type Capacity, type HandledAlert, type Option, type WorkloadAlert, type WorkloadRow, type WorkloadSettings } from "../types";
import { useRun } from "./shared";

type Props = {
  monday: string;
  rows: WorkloadRow[];
  alerts: WorkloadAlert[];
  handled: HandledAlert[];
  settings: WorkloadSettings;
  capacities: Capacity[];
  departments: Option[];
  dept: string;
  links: { prev: string; next: string; today: string; base: string; week: string };
  isThisWeek: boolean;
  canManage: boolean;
  canSettings: boolean;
};

/** A button that reads as plain text (person name opens the capacity editor). */
const plain = { flexWrap: "nowrap", background: "none", border: 0, padding: 0, textAlign: "left" } as const;

const hours = (n: number) => String(Math.round(n * 10) / 10);

function Bar({ pct, tone }: { pct: number; tone?: string }) {
  return (
    <div className={`bar${tone ? ` t-${tone}` : ""}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function WorkloadClient(p: Props) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capFor, setCapFor] = useState<WorkloadRow | null>(null);
  const days = weekDays(p.monday);
  const name = new Map(p.rows.map((r) => [r.person.id, r.person.name]));
  // Handled alerts stay listed (with Undo) even when the load changed and the alert no longer fires.
  const gone: WorkloadAlert[] = p.handled
    .filter((h) => name.has(h.member_id) && !p.alerts.some((a) => a.memberId === h.member_id && a.kind === h.kind))
    .map((h) => ({ memberId: h.member_id, kind: h.kind, detail: "", moveTicket: null }));
  const alerts = [...p.alerts, ...gone];

  const goDept = (value: string) => {
    const sep = p.links.base.includes("?") ? "&" : "?";
    router.push(`${p.links.base}${sep}week=${p.links.week}${value ? `&dept=${value}` : ""}`);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{weekTitle(p.monday)}</h3>
        <div className="row">
          <ButtonLink href={p.links.prev} size="sm" variant="ghost" aria-label="Previous week">
            <ChevronLeft size={16} />
          </ButtonLink>
          {p.isThisWeek ? null : (
            <ButtonLink href={p.links.today} size="sm">
              This week
            </ButtonLink>
          )}
          <ButtonLink href={p.links.next} size="sm" variant="ghost" aria-label="Next week">
            <ChevronRight size={16} />
          </ButtonLink>
          <Select aria-label="Department" value={p.dept} onChange={(e) => goDept(e.target.value)}>
            <option value="">All departments</option>
            {p.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {p.canSettings ? (
            <IconButton label="Workload settings" onClick={() => setSettingsOpen(true)}>
              <Settings size={16} />
            </IconButton>
          ) : null}
        </div>
      </div>

      {p.rows.length === 0 ? (
        <EmptyState title="No one to show for this week" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              {days.map((d) => (
                <Th key={d}>{dayHead(d)}</Th>
              ))}
              <Th>Week</Th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => {
              const tone = loadTone(r.pct, p.settings);
              return (
                <tr key={r.person.id}>
                  <Td style={{ whiteSpace: "nowrap" }}>
                    {p.canManage ? (
                      <button type="button" className="row" style={plain} onClick={() => setCapFor(r)} title="Edit capacity">
                        <Avatar name={r.person.name} size={24} /> {r.person.name}
                      </button>
                    ) : (
                      <span className="row" style={{ flexWrap: "nowrap" }}>
                        <Avatar name={r.person.name} size={24} /> {r.person.name}
                      </span>
                    )}
                  </Td>
                  {r.days.map((d, i) => {
                    const pct = d.capacity ? Math.round((d.planned / d.capacity) * 100) : d.planned ? 100 : 0;
                    return (
                      <Td key={days[i]} num className="small" style={{ whiteSpace: "nowrap" }}>
                        {hours(d.planned)} / {hours(d.capacity)}h
                        <Bar pct={pct} tone={dayTone(d.planned, d.capacity, p.settings)} />
                      </Td>
                    );
                  })}
                  <Td num style={{ whiteSpace: "nowrap" }}>
                    <b>
                      {hours(r.planned)} / {hours(r.capacity)}h
                    </b>
                    <Bar pct={r.pct} tone={tone} />
                    <span className={`small ${r.pct > 100 ? "t-warn" : "muted"}`}>{r.pct}%</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Card>
        <CardHead title="Capacity alerts" />
        <CardBody className="stack">
          {alerts.length === 0 ? <p className="muted">Everyone is within capacity this week.</p> : null}
          {alerts.map((a) => (
            <AlertRow
              key={`${a.memberId}-${a.kind}`}
              alert={a}
              name={name.get(a.memberId) ?? "Someone"}
              done={p.handled.find((h) => h.member_id === a.memberId && h.kind === a.kind) ?? null}
              targets={moveTargets(p.rows, a.memberId)}
              names={name}
              monday={p.monday}
              canManage={p.canManage}
            />
          ))}
        </CardBody>
      </Card>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={p.settings} />
      <CapacityDialog row={capFor} onClose={() => setCapFor(null)} capacities={p.capacities} />
    </div>
  );
}

function AlertRow({
  alert,
  name,
  done,
  targets,
  names,
  monday,
  canManage,
}: {
  alert: WorkloadAlert;
  name: string;
  done: HandledAlert | null;
  targets: { id: string; name: string; pct: number }[];
  names: Map<string, string>;
  monday: string;
  canManage: boolean;
}) {
  const { pending, run } = useRun();
  const [moveTo, setMoveTo] = useState("");
  const meta = ALERT_LABEL[alert.kind];
  const moved = done?.moved_to ? `Moved to ${names.get(done.moved_to) ?? "a teammate"}` : null;

  return (
    <div className="row between" style={{ opacity: done ? 0.6 : 1 }}>
      <span className="row" style={{ gap: 6 }}>
        <StatusDot tone={meta.tone}>{meta.label}</StatusDot> <b>{name}</b> <span className="muted">{alert.detail}</span>
        {moved ? <span className="muted small">{moved}</span> : null}
      </span>
      {canManage ? (
        <span className="row">
          {!done && alert.moveTicket && targets.length ? (
            <Select aria-label={`Move ${alert.moveTicket.key} to`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Move {alert.moveTicket.key} to…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.pct}%)
                </option>
              ))}
            </Select>
          ) : null}
          {done ? (
            <Button size="sm" disabled={pending} onClick={() => run(() => undoAlert(done.id), "Alert reopened")}>
              Undo
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    handleAlert({
                      memberId: alert.memberId,
                      weekStart: monday,
                      kind: alert.kind,
                      ...(moveTo && alert.moveTicket ? { moveTicketId: alert.moveTicket.id, moveTo } : {}),
                    }),
                  moveTo ? `${alert.moveTicket?.key} moved` : "Alert marked handled",
                )
              }
            >
              {moveTo ? "Move and mark handled" : "Handled"}
            </Button>
          )}
        </span>
      ) : null}
    </div>
  );
}

function SettingsDialog({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: WorkloadSettings }) {
  const { pending, run } = useRun();
  const formId = "wl-settings";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Workload alert settings"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={pending}>
            Save settings
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          run(() => saveWorkloadSettings(f), "Settings saved", onClose);
        }}
      >
        <FormGrid>
          <Field label="Overloaded above (%)" htmlFor="wl-over">
            <Input id="wl-over" name="overloaded_pct" type="number" min={50} max={300} defaultValue={settings.overloaded_pct} required />
          </Field>
          <Field label="Overdue tickets alert at" htmlFor="wl-overdue">
            <Input id="wl-overdue" name="overdue_count" type="number" min={0} max={50} defaultValue={settings.overdue_count} required />
          </Field>
          <Field label="Has room below (%)" htmlFor="wl-room">
            <Input id="wl-room" name="has_room_pct" type="number" min={0} max={100} defaultValue={settings.has_room_pct} required />
          </Field>
          <Field label="Default estimate when blank (min)" htmlFor="wl-est">
            <Input id="wl-est" name="default_estimate_min" type="number" min={0} max={2400} defaultValue={settings.default_estimate_min} required />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

function CapacityDialog({ row, onClose, capacities }: { row: WorkloadRow | null; onClose: () => void; capacities: Capacity[] }) {
  const { pending, run } = useRun();
  const cap = (row && capacities.find((c) => c.member_id === row.person.id)) ?? { member_id: row?.person.id ?? "", ...DEFAULT_CAPACITY };
  const formId = "wl-capacity";
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      title={row ? `Capacity for ${row.person.name}` : "Capacity"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={pending}>
            Save capacity
          </Button>
        </>
      }
    >
      {row ? (
        <form
          id={formId}
          key={row.person.id}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => saveCapacity({ memberId: row.person.id, weeklyHours: f.get("weekly_hours"), workdays: f.getAll("workdays") }), "Capacity saved", onClose);
          }}
        >
          <FormGrid>
            <Field label="Hours per week" htmlFor="wl-hours" full>
              <Input id="wl-hours" name="weekly_hours" type="number" step="0.5" min={0} max={120} defaultValue={cap.weekly_hours} required />
            </Field>
            <Field label="Works on" full>
              <div className="row">
                {WEEKDAYS.map((d, i) => (
                  <Checkbox key={d} name="workdays" value={i + 1} defaultChecked={cap.workdays.includes(i + 1)} label={d.slice(0, 3)} />
                ))}
              </div>
            </Field>
          </FormGrid>
        </form>
      ) : null}
    </Dialog>
  );
}
