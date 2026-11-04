"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, Button, ButtonLink, IconButton, Card, CardBody, CardHead, Checkbox, Dialog, Field, FormGrid, StatCard, Stats, Table, Tabs, Td, Th, useToast } from "@/components/ui";
import { money, monthLabel, niceTop } from "@/lib/modules/finance/core/logic";
import { byService, hoursTone, marginPct, marginTone, type ClientProfit, type computeProfitability } from "@/lib/modules/finance/ops/logic";
import type { OpsSettings } from "@/lib/modules/finance/ops/types";
import { saveProfitSettings } from "../actions";
import s from "../../payments/_components/ops.module.css";

export type MonthProfit = { month: string } & ReturnType<typeof computeProfitability>;
type Sort = "margin" | "fee" | "cost" | "hours" | "name";

const usd0 = (n: number) => money(n, "USD", 0);
const pct = (n: number) => `${Math.round(n)}%`;

type Nav = { label: string; prev: string | null; next: string | null };

export function ProfitView({ months, settings, canSettings, nav }: { months: MonthProfit[]; settings: OpsSettings; canSettings: boolean; nav: Nav }) {
  const [tab, setTab] = useState("client");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("margin");
  const [picked, setPicked] = useState<ClientProfit | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cur = months[months.length - 1];
  const alert = settings.marginAlertPct;
  const t = cur.totals;

  const needle = q.trim().toLowerCase();
  const sorters: Record<Sort, (a: ClientProfit, b: ClientProfit) => number> = {
    margin: (a, b) => a.marginPct - b.marginPct,
    fee: (a, b) => b.fee - a.fee,
    cost: (a, b) => b.cost - a.cost,
    hours: (a, b) => (b.budget ? b.hours / b.budget : 0) - (a.budget ? a.hours / a.budget : 0),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  const clients = cur.clients.filter((c) => !needle || c.name.toLowerCase().includes(needle)).sort(sorters[sort]);

  return (
    <>
      <div className="row between">
        <div className={s.monthnav}>
          <h1 className="sr-only">Profitability</h1>
          <MonthLink href={nav.prev} label="Previous month" icon={<ChevronLeft />} />
          <strong>{nav.label}</strong>
          <MonthLink href={nav.next} label="Next month" icon={<ChevronRight />} />
        </div>
        {canSettings ? <Button onClick={() => setSettingsOpen(true)}>Profit settings</Button> : null}
      </div>

      <Stats>
        <StatCard label="Fees" value={usd0(t.fees)} sub={t.agreedFeeUsed ? "Agreed fee where not invoiced yet" : "Invoiced this month"} />
        <StatCard label="Client cost" value={usd0(t.cost)} sub="Logged plus estimated time" />
        <StatCard label="Gross margin" value={pct(t.marginPct)} tone={marginTone(t.marginPct, alert)} sub={`${usd0(t.margin)} · alert below ${alert}%`} />
        <StatCard label="Overhead" value={usd0(t.overhead)} sub="Non-client roles" />
        <StatCard label="After all salaries" value={usd0(t.after)} tone={t.after < 0 ? "danger" : undefined} sub={`Salaries ${usd0(t.salaries)}`} />
      </Stats>

      <Tabs
        label="Profitability view"
        value={tab}
        onChange={setTab}
        items={[
          { value: "client", label: "Client" },
          { value: "service", label: "Service" },
          { value: "dept", label: "Department" },
          { value: "trend", label: "6-month trend" },
        ]}
      />

      {tab === "client" ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="toolbar">
            <input type="search" placeholder="Search clients" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="margin">Lowest margin first</option>
              <option value="fee">Highest fees</option>
              <option value="cost">Highest cost</option>
              <option value="hours">Most hours used</option>
              <option value="name">Name</option>
            </select>
          </div>
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th right>Fees</Th>
                  <Th right>Logged cost</Th>
                  <Th right hideSm>
                    Estimated cost
                  </Th>
                  <Th right>Margin</Th>
                  <Th right>Margin %</Th>
                  <Th>Hours vs budget</Th>
                </tr>
              </thead>
              <tbody>
                {clients.length ? (
                  clients.map((c) => (
                    <tr key={c.id} className={s.clickRow} tabIndex={0} onClick={() => setPicked(c)} onKeyDown={(e) => e.key === "Enter" && setPicked(c)}>
                      <Td>
                        {c.name}
                        <div className="small muted">{c.basis}</div>
                      </Td>
                      <Td right num>
                        {usd0(c.fee)}
                      </Td>
                      <Td right num>
                        {usd0(c.logged)}
                      </Td>
                      <Td right num hideSm>
                        {usd0(c.estimated)}
                      </Td>
                      <Td right num>
                        {usd0(c.margin)}
                      </Td>
                      <Td right num>
                        <span className={`t-${marginTone(c.marginPct, alert)}`}>{pct(c.marginPct)}</span>
                      </Td>
                      <Td className={s.hours}>
                        <HoursBar hours={c.hours} budget={c.budget} />
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={7} className="muted">
                      {cur.clients.length ? "No clients match." : "No fees or logged time this month."}
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
          <p className="small muted">
            Hourly cost is monthly salary divided by {settings.workingHours} working hours. Logged hours cost the client they were logged on; the rest of a
            client-facing person&apos;s time is split across their clients as estimated cost.
          </p>
        </div>
      ) : null}

      {tab === "service" ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th right>Clients</Th>
                <Th right>Fees</Th>
                <Th right>Cost</Th>
                <Th right>Margin</Th>
                <Th right>Margin %</Th>
              </tr>
            </thead>
            <tbody>
              {byService(cur.clients).map((r) => (
                <tr key={r.service}>
                  <Td>{r.service}</Td>
                  <Td right num>
                    {r.clients}
                  </Td>
                  <Td right num>
                    {usd0(r.fee)}
                  </Td>
                  <Td right num>
                    {usd0(r.cost)}
                  </Td>
                  <Td right num>
                    {usd0(r.margin)}
                  </Td>
                  <Td right num>
                    <span className={`t-${marginTone(r.marginPct, alert)}`}>{pct(r.marginPct)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === "dept" ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Department</Th>
                <Th right>People</Th>
                <Th right>Salaries</Th>
                <Th right>Hours</Th>
                <Th right>On clients</Th>
                <Th right>Cost to clients</Th>
                <Th right>Overhead</Th>
              </tr>
            </thead>
            <tbody>
              {cur.depts.map((d) => (
                <tr key={d.department}>
                  <Td>{d.department}</Td>
                  <Td right num>
                    {d.people}
                  </Td>
                  <Td right num>
                    {usd0(d.salaries)}
                  </Td>
                  <Td right num>
                    {Math.round(d.hours)}
                  </Td>
                  <Td right num>
                    {pct(d.onClients * 100)}
                  </Td>
                  <Td right num>
                    {usd0(d.toClients)}
                  </Td>
                  <Td right num>
                    {usd0(d.overhead)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === "trend" ? <Trend months={months} alert={alert} /> : null}

      <Dialog
        open={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.name ?? "Client"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPicked(null)}>
              Close
            </Button>
            {picked ? (
              <ButtonLink variant="primary" href={`/clients/${picked.id}`}>
                Open client
              </ButtonLink>
            ) : null}
          </>
        }
      >
        {picked ? (
          <div className="stack">
            <dl className={s.kv}>
              <dt>Fees</dt>
              <dd className="num">
                {usd0(picked.fee)} <span className="muted small">({picked.basis.toLowerCase()})</span>
              </dd>
              <dt>Logged cost</dt>
              <dd className="num">{usd0(picked.logged)}</dd>
              <dt>Estimated cost</dt>
              <dd className="num">{usd0(picked.estimated)}</dd>
              <dt>Margin</dt>
              <dd className="num">
                <span className={`t-${marginTone(picked.marginPct, alert)}`}>{pct(picked.marginPct)}</span> · {usd0(picked.margin)}
              </dd>
              <dt>Hours</dt>
              <dd className="num">{picked.budget ? `${picked.hours} of ${picked.budget} budgeted` : `${picked.hours}, no budget set`}</dd>
              <dt>Services</dt>
              <dd>{picked.services.join(", ") || "—"}</dd>
            </dl>
            <h4>Who worked on it</h4>
            {picked.people.length ? (
              <div className="list">
                {picked.people.map((p) => (
                  <div key={p.id} className="item row between">
                    <span className="row">
                      <Avatar name={p.name} size={24} /> {p.name}
                    </span>
                    <span className="num small muted">{Math.round(p.hours)} h</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="muted">No time logged this month.</span>
            )}
          </div>
        ) : null}
      </Dialog>

      {canSettings ? <SettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}

function MonthLink({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
  return href ? (
    <Link href={href} className="icon-btn" aria-label={label} title={label}>
      {icon}
    </Link>
  ) : (
    <IconButton label={label} disabled>
      {icon}
    </IconButton>
  );
}

function HoursBar({ hours, budget }: { hours: number; budget: number | null }) {
  if (!budget) return <span className="small muted num">{Math.round(hours)} h, no budget</span>;
  const share = Math.round((hours / budget) * 100);
  return (
    <>
      <div>
        <span className="num">
          {Math.round(hours)} of {budget} h
        </span>
        <span className="num muted">{share}%</span>
      </div>
      <div className={`bar t-${hoursTone(hours, budget)}`}>
        <i style={{ width: `${Math.min(100, share)}%` }} />
      </div>
    </>
  );
}

function Trend({ months, alert }: { months: MonthProfit[]; alert: number }) {
  const pts = months.map((m) => ({ m: m.month, f: m.totals.fees, c: m.totals.cost, after: m.totals.after }));
  const W = 640;
  const H = 230;
  const L = 56;
  const T = 14;
  const B = 30;
  const ph = H - T - B;
  const max = niceTop(Math.max(1, ...pts.map((p) => Math.max(p.f, p.c))));
  const min = Math.min(0, ...pts.map((p) => p.after));
  const x = (k: number) => L + ((W - L - 20) * k) / Math.max(pts.length - 1, 1);
  const y = (v: number) => T + ph - (ph * (v - min)) / (max - min || 1);
  const k = (v: number) => `${Math.round(v / 1000)}k`;
  const line = (key: "f" | "c" | "after", col: string) => (
    <g key={key}>
      <polyline fill="none" stroke={`var(${col})`} strokeWidth={2.5} points={pts.map((p, i) => `${x(i)},${y(p[key])}`).join(" ")} />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p[key])} r={3.5} style={{ fill: `var(${col})` }}>
          <title>{usd0(p[key])}</title>
        </circle>
      ))}
    </g>
  );
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead
          title="Last 6 months, USD"
          actions={
            <div className={s.legend}>
              <span>
                <i style={{ background: "var(--accent)" }} />
                Fees
              </span>
              <span>
                <i style={{ background: "var(--warn)" }} />
                Client cost
              </span>
              <span>
                <i style={{ background: "var(--blue)" }} />
                After all salaries
              </span>
            </div>
          }
        />
        <CardBody>
          <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Six month profitability trend">
            {[0, 1, 2, 3, 4].map((g) => {
              const v = min + ((max - min) * g) / 4;
              return (
                <g key={g}>
                  <line x1={L} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                  <text x={L - 8} y={y(v) + 4} textAnchor="end">
                    {k(v)}
                  </text>
                </g>
              );
            })}
            {line("f", "--accent")}
            {line("c", "--warn")}
            {line("after", "--blue")}
            {pts.map((p, i) => (
              <text key={p.m} x={x(i)} y={H - 8} textAnchor="middle">
                {monthLabel(p.m)}
              </text>
            ))}
          </svg>
        </CardBody>
      </Card>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th right>Fees</Th>
              <Th right>Client cost</Th>
              <Th right>Gross margin</Th>
              <Th right>After all salaries</Th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p) => {
              const m = marginPct(p.f, p.c);
              return (
                <tr key={p.m}>
                  <Td>
                    {monthLabel(p.m)} {p.m.slice(0, 4)}
                  </Td>
                  <Td right num>
                    {usd0(p.f)}
                  </Td>
                  <Td right num>
                    {usd0(p.c)}
                  </Td>
                  <Td right num>
                    <span className={`t-${marginTone(m, alert)}`}>{pct(m)}</span>
                  </Td>
                  <Td right num>
                    {usd0(p.after)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function SettingsDialog({ open, settings, onClose }: { open: boolean; settings: OpsSettings; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    marginAlertPct: String(settings.marginAlertPct),
    workingHours: String(settings.workingHours),
    alertMargin: settings.alertMargin,
    alertBudget: settings.alertBudget,
    alertNegative: settings.alertNegative,
    alertTo: settings.alertTo,
  });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Profit settings"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="profit-settings" disabled={busy}>
            Save settings
          </Button>
        </>
      }
    >
      <form
        id="profit-settings"
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await saveProfitSettings({ ...f, marginAlertPct: Number(f.marginAlertPct), workingHours: Number(f.workingHours) });
          setBusy(false);
          if (!res.ok) return toast(res.error);
          toast("Profit settings saved");
          onClose();
          router.refresh();
        }}
      >
        <FormGrid>
          <Field label="Margin alert below (%)" htmlFor="ps-alert">
            <input id="ps-alert" type="number" min="0" max="100" value={f.marginAlertPct} onChange={(e) => setF({ ...f, marginAlertPct: e.target.value })} required />
          </Field>
          <Field label="Working hours a month" htmlFor="ps-hours">
            <input id="ps-hours" type="number" min="1" max="400" value={f.workingHours} onChange={(e) => setF({ ...f, workingHours: e.target.value })} required />
          </Field>
          <Field label="Send the monthly alert to" htmlFor="ps-to" full>
            <select id="ps-to" value={f.alertTo} onChange={(e) => setF({ ...f, alertTo: e.target.value as OpsSettings["alertTo"] })}>
              <option value="leaders">CEO and finance head</option>
              <option value="finance">Finance team only</option>
            </select>
          </Field>
        </FormGrid>
        <Checkbox label="Alert when a client's margin drops below the threshold" checked={f.alertMargin} onChange={(e) => setF({ ...f, alertMargin: e.target.checked })} />
        <Checkbox label="Alert at 80% and 100% of a client's hours budget" checked={f.alertBudget} onChange={(e) => setF({ ...f, alertBudget: e.target.checked })} />
        <Checkbox label="Alert when after-salaries result is negative" checked={f.alertNegative} onChange={(e) => setF({ ...f, alertNegative: e.target.checked })} />
      </form>
    </Dialog>
  );
}
