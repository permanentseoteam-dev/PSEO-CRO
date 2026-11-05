import Link from "next/link";
import { ClientActivityLinesCard, ClientHealthCard, ClientTermsCard, ClientVaultCard } from "@/features/client-admin/sections";
import { FirefliesCallsCard } from "@/features/platform-p2/components/server";
import { Avatar, Avatars, ButtonLink, Card, CardBody, CardHead, EmptyState, PhaseTwo, StatCard, Stats, StatusDot, Table, Td, Th, TicketStatusDot, type TicketStatus } from "@/components/ui";
import { fmtDay, fmtMeeting, LOG_KINDS, SEVERITY, TEAM_ROLES, windowStatus } from "@/lib/modules/clients/logic";
import type { ClientPage, Person } from "@/lib/modules/clients/types";
import { BandDot, HealthRing } from "../../_components/health-ring";
import s from "../../_components/clients.module.css";
import { CloseEscalationButton, BrandingForm, ContactButton, EscalateButton, LoginRole, NotesButton, QuickLog, RecalcButton, TeamEditor } from "./client-actions";

type P = { page: ClientPage; now: Date; year: string };
const yes = (b: boolean) => (b ? "Yes" : "No");
const kindLabel = (k: string) => (LOG_KINDS as Record<string, string>)[k] ?? (k === "meeting_notes" ? "Meeting notes" : k === "escalation" ? "Escalation" : k);

// ---------------------------------------------------------------- Overview
export function Overview({ page, now, year, canManage, showTerms }: P & { canManage: boolean; showTerms: boolean }) {
  const { client, team, escalations } = page;
  const openEsc = escalations.filter((e) => e.status === "open");
  const factors = client.health_factors ?? [];
  return (
    <div className="grid-2">
      <Card>
        <CardHead title="Timeline" />
        <CardBody>
          {page.timeline.length ? (
            <div className="list">
              {page.timeline.slice(0, 6).map((t) => (
                <div className="item" key={t.id}>
                  <div className={s.tl}>
                    <span className="small muted">{fmtDay(t.happened_on, year)}</span>
                    <span>
                      {t.kind === "meeting_notes" ? `Meeting notes: ${t.body}` : t.body}
                      {t.with_name ? <span className="small muted"> · {t.with_name}</span> : null}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">Nothing logged yet.</p>
          )}
        </CardBody>
      </Card>

      {showTerms ? <ClientTermsCard clientId={client.id} /> : null}

      <Card>
        <CardHead title="Health" actions={canManage ? <RecalcButton clientId={client.id} /> : null} />
        <CardBody>
          <div className="row" style={{ gap: 16, alignItems: "center" }}>
            <HealthRing score={client.health_score} size={72} />
            <div className="stack" style={{ gap: 4 }}>
              <BandDot band={client.health_band} />
              <span className="small muted">{client.health_at ? `Scored ${fmtDay(client.health_at.slice(0, 10), year)}` : "Not scored yet"}</span>
            </div>
          </div>
          {factors.length ? (
            <Table wrapClassName="mt-3">
              <tbody>
                {factors.map((f) => (
                  <tr key={f.label}>
                    <Td>{f.label}</Td>
                    <Td right num>
                      {f.points}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </CardBody>
      </Card>

      <ClientHealthCard clientId={client.id} />

      <Card>
        <CardHead title="Upcoming meetings" actions={<ButtonLink size="sm" href="/calendar">Schedule</ButtonLink>} />
        <CardBody>
          <Meetings page={page} />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Open escalations" />
        <CardBody>
          {openEsc.length ? (
            <div className="list">
              {openEsc.map((e) => {
                const w = windowStatus({ severity: e.severity, dueAt: e.due_at, closedAt: e.closed_at }, now);
                return (
                  <div className="item between" key={e.id}>
                    <div className="stack" style={{ gap: 2 }}>
                      <strong>{e.title}</strong>
                      <span className="small muted">
                        {SEVERITY[e.severity].label} · opened {fmtDay(e.opened_at.slice(0, 10), year)}
                        {e.ticketKey ? ` · ticket ${e.ticketKey}` : ""}
                      </span>
                    </div>
                    <StatusDot tone={w.past ? "danger" : "ok"}>{w.past ? "Past window" : "Within window"}</StatusDot>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted small">No open escalations.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Team" />
        <CardBody>
          {team.length ? (
            <div className="list">
              {team.map((t) => (
                <div className="item row" style={{ gap: 10 }} key={t.member_id}>
                  <Avatar name={t.name} size={28} />
                  <div className="stack" style={{ gap: 0 }}>
                    <strong>{t.name}</strong>
                    <span className="small muted">
                      {(TEAM_ROLES as Record<string, string>)[t.role]}
                      {t.department ? ` · ${t.department}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No one assigned yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Meetings({ page }: { page: ClientPage }) {
  if (!page.meetings.length) return <p className="muted small">None booked.</p>;
  return (
    <div className="list">
      {page.meetings.map((m) => (
        <div className="item between" key={m.id}>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{m.title}</strong>
            <span className="small muted">
              {fmtMeeting(m.starts_at)}
              {m.where ? ` · ${m.where}` : ""}
            </span>
          </div>
          <Avatars>
            {m.people.slice(0, 4).map((n) => (
              <Avatar key={n} name={n} size={24} />
            ))}
          </Avatars>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Contacts & team
export function ContactsTeam({ page, people, canManage }: { page: ClientPage; people: Person[]; canManage: boolean }) {
  const id = page.client.id;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead title="Client contacts" actions={canManage ? <ContactButton clientId={id} /> : null} />
        {page.contacts.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Email</Th>
                <Th hideSm>Phone</Th>
                <Th>Main contact</Th>
                <Th hideSm>Gets reports</Th>
                {canManage ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {page.contacts.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar name={c.name} size={24} />
                      {c.is_main ? <strong>{c.name}</strong> : c.name}
                    </div>
                  </Td>
                  <Td>{c.role}</Td>
                  <Td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}</Td>
                  <Td hideSm>{c.phone}</Td>
                  <Td>{yes(c.is_main)}</Td>
                  <Td hideSm>{yes(c.gets_reports)}</Td>
                  {canManage ? (
                    <Td right>
                      <ContactButton clientId={id} contact={c} />
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="muted small">No contacts yet.</p>
          </CardBody>
        )}
      </Card>
      <Card>
        <CardHead title="Our team on this client" actions={canManage ? <TeamEditor clientId={id} people={people} team={page.team} /> : null} />
        {page.team.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role on client</Th>
                <Th hideSm>Department</Th>
                <Th num>Hours this month</Th>
              </tr>
            </thead>
            <tbody>
              {page.team.map((t) => (
                <tr key={t.member_id}>
                  <Td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar name={t.name} size={24} />
                      {t.name}
                    </div>
                  </Td>
                  <Td>{(TEAM_ROLES as Record<string, string>)[t.role]}</Td>
                  <Td hideSm>{t.department}</Td>
                  <Td num>{Math.round(t.minutes / 60)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="muted small">No one assigned yet.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Meetings & notes
export function MeetingsNotes({ page, year }: { page: ClientPage; year: string }) {
  const notes = page.timeline.filter((t) => t.kind === "meeting_notes");
  const log = page.timeline.filter((t) => t.kind !== "meeting_notes" && t.kind !== "escalation");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead title="Quick log" />
        <CardBody>
          <QuickLog clientId={page.client.id} />
        </CardBody>
      </Card>
      <div className="grid-2">
        <Card>
          <CardHead title="Upcoming" actions={<ButtonLink size="sm" variant="primary" href="/calendar">Schedule meeting</ButtonLink>} />
          <CardBody>
            <Meetings page={page} />
          </CardBody>
        </Card>
        <FirefliesCallsCard clientId={page.client.id} />
      </div>
      <Card>
        <CardHead title="Meeting notes" actions={<NotesButton clientId={page.client.id} />} />
        <CardBody>
          {notes.length ? (
            <div className="list">
              {notes.map((n) => (
                <div className="item stack" key={n.id}>
                  <div className="between">
                    <strong>
                      {n.body} · {fmtDay(n.happened_on, year)}
                    </strong>
                    <span className="small muted">{n.by}</span>
                  </div>
                  {n.decisions ? (
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Decisions:</strong> {n.decisions}
                    </p>
                  ) : null}
                  {n.concerns ? (
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Concerns:</strong> {n.concerns}
                    </p>
                  ) : null}
                  {n.action_items.length ? (
                    <div className="small">
                      <strong>Action items:</strong> {n.action_items.join(" · ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No meeting notes yet.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHead title="Calls and chats" />
        {log.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Kind</Th>
                <Th>Note</Th>
                <Th hideSm>With</Th>
                <Th hideSm>By</Th>
              </tr>
            </thead>
            <tbody>
              {log.map((t) => (
                <tr key={t.id}>
                  <Td>{fmtDay(t.happened_on, year)}</Td>
                  <Td>{kindLabel(t.kind)}</Td>
                  <Td>{t.body}</Td>
                  <Td hideSm>{t.with_name}</Td>
                  <Td hideSm>{t.by}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="muted small">Nothing logged yet.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Escalations
export function Escalations({ page, people, now, year }: P & { people: Person[] }) {
  const list = page.escalations;
  const open = list.filter((e) => e.status === "open");
  const past = open.filter((e) => Date.parse(e.due_at) < now.getTime());
  const closedYear = list.filter((e) => e.closed_at?.startsWith(year));
  const rated = list.filter((e) => e.client_rating != null);
  const avg = rated.length ? (rated.reduce((a, e) => a + e.client_rating!, 0) / rated.length).toFixed(1) : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Stats>
        <StatCard label="Open" value={open.length} tone={open.length ? "warn" : undefined} />
        <StatCard label="Past window" value={past.length} sub={past[0]?.title} tone={past.length ? "danger" : undefined} />
        <StatCard label="Closed this year" value={closedYear.length} />
        <StatCard label="Average client rating" value={avg ? `${avg} / 5` : "–"} />
      </Stats>
      <Card>
        <CardHead title="Escalations" actions={<EscalateButton clientId={page.client.id} people={people} size="sm" variant="danger" />} />
        {list.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Opened</Th>
                <Th>Issue</Th>
                <Th>Severity</Th>
                <Th>Response window</Th>
                <Th hideSm>Ticket</Th>
                <Th hideSm>Owner</Th>
                <Th>Status</Th>
                <Th>Client rating</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const w = windowStatus({ severity: e.severity, dueAt: e.due_at, closedAt: e.closed_at }, now);
                return (
                  <tr key={e.id}>
                    <Td>{fmtDay(e.opened_at.slice(0, 10), year)}</Td>
                    <Td>{e.status === "open" ? <strong>{e.title}</strong> : e.title}</Td>
                    <Td>
                      <StatusDot tone={SEVERITY[e.severity].tone}>{SEVERITY[e.severity].label}</StatusDot>
                    </Td>
                    <Td className={w.past ? "t-danger" : undefined}>{w.text}</Td>
                    <Td hideSm>{e.ticketKey ? <Link href={`/t/${e.ticketKey}`}>{e.ticketKey}</Link> : <span className="muted">None</span>}</Td>
                    <Td hideSm>{e.owner}</Td>
                    <Td>
                      {e.ticketStatus ? (
                        <TicketStatusDot status={e.ticketStatus as TicketStatus} />
                      ) : (
                        <StatusDot tone={e.status === "open" ? "blue" : "ok"}>{e.status === "open" ? "Open" : "Closed"}</StatusDot>
                      )}
                    </Td>
                    <Td num>{e.client_rating ? `${e.client_rating} / 5` : <span className="muted">After close</span>}</Td>
                    <Td right>{e.status === "open" ? <CloseEscalationButton id={e.id} clientId={page.client.id} /> : null}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="muted small">No escalations. Good.</p>
          </CardBody>
        )}
      </Card>
      <p className="small muted">Severity sets the response window in working hours: Critical 2h, High 8h, Medium 24h, Low 72h.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Files
export function FilesLink({ page }: { page: ClientPage }) {
  return (
    <Card>
      <CardBody>
        <EmptyState
          title={`Files for ${page.client.name}`}
          action={
            <ButtonLink variant="primary" href={`/files?client=${page.client.id}`}>
              Open in Files
            </ButtonLink>
          }
        >
          Brand assets, files from the client and custom folders live in Files.
        </EmptyState>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- Client portal
export function Portal({ page, canManage, canAdmin }: { page: ClientPage; canManage: boolean; canAdmin: boolean }) {
  const c = page.client;
  return (
    <div className="grid-2">
      <Card>
        <CardHead title="Logins" actions={canAdmin ? <ButtonLink size="sm" variant="primary" href="/admin/invites">Invite</ButtonLink> : null} />
        {page.logins.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th hideSm>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {page.logins.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <strong>{l.name}</strong>
                  </Td>
                  <Td hideSm>{l.email}</Td>
                  <Td>
                    {canAdmin && l.status === "active" ? (
                      <LoginRole clientId={c.id} memberId={l.id} role={l.role} name={l.name} />
                    ) : l.role === "client_owner" ? (
                      "Owner"
                    ) : (
                      "Viewer"
                    )}
                  </Td>
                  <Td>
                    <StatusDot tone={l.status === "active" ? "ok" : l.status === "invited" ? "blue" : "muted"}>
                      {l.status === "active" ? "Active" : l.status === "invited" ? "Invited" : "Removed"}
                    </StatusDot>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="muted small">No one from {c.name} can log in yet.</p>
          </CardBody>
        )}
        <CardBody>
          <p className="small muted" style={{ margin: 0 }}>
            Owners see billing and approvals. Viewers don&apos;t.
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHead title="Branding" />
        <CardBody>
          {canManage ? (
            <BrandingForm clientId={c.id} color={c.portal_color} welcome={c.portal_welcome} logo={c.portal_logo_url} />
          ) : (
            <div className="stack small">
              <div className="between">
                <span className="muted">Brand colour</span>
                <span>{c.portal_color ?? "Default"}</span>
              </div>
              <div className="between">
                <span className="muted">Welcome line</span>
                <span>{c.portal_welcome ?? "Default"}</span>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <span className="small muted">
              See as client <PhaseTwo />
            </span>
          </div>
        </CardBody>
      </Card>
      <ClientVaultCard clientId={c.id} />
      <ClientActivityLinesCard clientId={c.id} />
    </div>
  );
}
