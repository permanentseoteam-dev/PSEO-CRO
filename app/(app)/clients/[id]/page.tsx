import { notFound } from "next/navigation";
import { requireMe, can } from "@/lib/auth/can";
import { Avatar, ButtonLink, Card, CardBody, EmptyState, NoAccess, PhaseTwo, StatusDot, Tabs } from "@/components/ui";
import { CHANNELS, daysAgo, daysBetween, dubaiDate, fmtDay, fmtMeeting, fmtMonth, money, statusLabel, statusTone } from "@/lib/modules/clients/logic";
import { getClient, listPeople } from "@/lib/modules/clients/queries";
import { BandDot, HealthRing } from "../_components/health-ring";
import { ClientFormButton } from "../_components/client-form";
import s from "../_components/clients.module.css";
import { EscalateButton, LogButton } from "./_components/client-actions";
import { ContactsTeam, Escalations, FilesLink, MeetingsNotes, Overview, Portal } from "./_components/panels";

export const metadata = { title: "Client" };

// [value, label, phase 2]
const TABS: [string, string, boolean][] = [
  ["overview", "Overview", false],
  ["accounts", "Accounts & projects", true],
  ["commitments", "Commitments", true],
  ["relationship", "Relationship", true],
  ["meetings", "Meetings & notes", false],
  ["reports", "Reports", true],
  ["escalations", "Escalations", false],
  ["ratings", "Delivery ratings", true],
  ["contacts", "Contacts & team", false],
  ["files", "Files", false],
  ["performance", "Performance", true],
  ["analysis", "Analysis", true],
  ["ads", "Ads", true],
  ["leads", "Leads", true],
  ["website", "Website", true],
  ["seo", "SEO", true],
  ["portal", "Client portal", false],
];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const now = new Date();
  const [page, people] = await Promise.all([getClient(id, now), listPeople()]);
  if (!page) notFound();
  const { client, terms } = page;
  const today = dubaiDate(now);
  const year = today.slice(0, 4);
  const tab = TABS.find((t) => t[0] === rawTab) ?? TABS[0];
  const canManage = can(me, "clients.manage");
  const canAdmin = can(me, "admin.access.manage", "all");
  const showTerms = can(me, "clients.billing.view");
  const canEditTerms = can(me, "clients.billing.edit") || canManage;
  const main = page.contacts.find((c) => c.is_main && c.email) ?? page.contacts.find((c) => c.email);
  const contactDays = page.lastContact ? Math.max(0, daysBetween(page.lastContact, today)) : null;
  const balance = page.balance?.filter((b) => b.amount > 0) ?? null;

  return (
    <div className="page">
      <Card>
        <CardBody className="stack" style={{ gap: 14 }}>
          <div className={s.head}>
            <HealthRing score={client.health_score} size={76} />
            <div className="stack" style={{ gap: 6, flex: 1, minWidth: 220 }}>
              <div className="row" style={{ gap: 14, alignItems: "center" }}>
                <h1>{client.name}</h1>
                <BandDot band={client.health_band} />
                <StatusDot tone={statusTone(client.status)}>{statusLabel(client.status)}</StatusDot>
              </div>
              <div className="row small" style={{ gap: 16 }}>
                {page.ownerName ? (
                  <span className="row" style={{ gap: 6 }}>
                    <Avatar name={page.ownerName} size={22} />
                    Executive: {page.ownerName}
                  </span>
                ) : null}
                {page.managerName ? (
                  <span className="row" style={{ gap: 6 }}>
                    <Avatar name={page.managerName} size={22} />
                    Manager: {page.managerName}
                  </span>
                ) : null}
                {client.site ? (
                  <a href={client.site.startsWith("http") ? client.site : `https://${client.site}`} target="_blank" rel="noreferrer">
                    {client.site.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
                <span className="muted">Channel: {(CHANNELS as Record<string, string>)[client.channel] ?? client.channel}</span>
                <span className="muted">Last contact: {daysAgo(contactDays).toLowerCase()}</span>
                {client.services.length ? <span className="muted">Services: {client.services.join(", ")}</span> : null}
              </div>
              {client.notes ? (
                <div className={`${s.notes} small`}>
                  <strong>Internal notes:</strong> {client.notes}
                </div>
              ) : null}
              {client.end_date ? (
                <div className="small muted">
                  Ended {fmtDay(client.end_date, year)}
                  {client.end_reason ? ` · ${client.end_reason}` : ""}
                </div>
              ) : null}
            </div>
          </div>
          <div className="row">
            {main?.email ? (
              <a className="btn primary" href={`mailto:${main.email}`}>
                Email client
              </a>
            ) : null}
            <ButtonLink href="/calendar">Schedule meeting</ButtonLink>
            <EscalateButton clientId={client.id} people={people} />
            <LogButton clientId={client.id} contacts={page.contacts} />
            {canManage ? (
              <ClientFormButton
                people={people}
                client={client}
                fee={terms ? { monthly_fee: terms.monthly_fee, hours_per_month: terms.hours_per_month } : null}
                showFee={showTerms && canEditTerms}
                label="Edit"
              />
            ) : null}
          </div>
        </CardBody>
      </Card>

      <div className={s.facts}>
        {showTerms && terms?.monthly_fee != null ? (
          <div>
            <span className="small muted">Monthly fee</span>
            <strong className="num">{money(Number(terms.monthly_fee), terms.currency)}</strong>
          </div>
        ) : null}
        <div>
          <span className="small muted">Client since</span>
          <strong>{client.start_date ? fmtMonth(client.start_date) : "Not set"}</strong>
        </div>
        <div>
          <span className="small muted">Open tickets</span>
          <strong className="num">{page.openTickets}</strong>
        </div>
        <div>
          <span className="small muted">Overdue</span>
          <strong className={`num ${page.overdueTickets ? "t-danger" : ""}`}>{page.overdueTickets}</strong>
        </div>
        <div>
          <span className="small muted">Hours this month</span>
          <strong className="num">
            {page.hoursThisMonth}
            {showTerms && terms?.hours_per_month ? ` of ${terms.hours_per_month}` : ""}
          </strong>
        </div>
        {showTerms && balance ? (
          <div>
            <span className="small muted">Balance due</span>
            <strong className="num">{balance.length ? balance.map((b) => money(b.amount, b.currency)).join(" + ") : "Nothing due"}</strong>
          </div>
        ) : null}
        <div>
          <span className="small muted">Next meeting</span>
          <strong>{page.meetings[0] ? fmtMeeting(page.meetings[0].starts_at) : "None booked"}</strong>
        </div>
      </div>

      <Tabs
        label="Client sections"
        value={tab[0]}
        items={TABS.map(([value, label, p2]) => ({
          value,
          href: value === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${value}`,
          label: p2 ? (
            <>
              {label} <PhaseTwo />
            </>
          ) : (
            label
          ),
        }))}
      />

      {tab[2] ? (
        <Card>
          <CardBody>
            <EmptyState title={tab[1]}>This section arrives in phase 2.</EmptyState>
          </CardBody>
        </Card>
      ) : tab[0] === "overview" ? (
        <Overview page={page} now={now} year={year} canManage={canManage} showTerms={showTerms} canEditTerms={canEditTerms} />
      ) : tab[0] === "meetings" ? (
        <MeetingsNotes page={page} year={year} />
      ) : tab[0] === "escalations" ? (
        <Escalations page={page} people={people} now={now} year={year} />
      ) : tab[0] === "contacts" ? (
        <ContactsTeam page={page} people={people} canManage={canManage} />
      ) : tab[0] === "files" ? (
        <FilesLink page={page} />
      ) : (
        <Portal page={page} canManage={canManage} canAdmin={canAdmin} />
      )}
    </div>
  );
}
